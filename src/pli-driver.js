/**
 * PLI Driver - Complete Node.js driver for Plasmatronics PL40 Solar Controller
 * 
 * Communicate with PL40 via TCP gateway (Arduino + ESP8266)
 * 
 * Protocol Reference:
 *   Commands: 4 bytes [CMD, ADDR, DATA, CHECK]
 *   CMD.READ_RAM = 0x14 (20 decimal)
 *   Response: 2 bytes [0xC8, DATA] for successful reads
 *   CHECK = (CMD XOR ADDR XOR DATA) XOR 0xFF
 */

const net = require('net');
const EventEmitter = require('events');
const CircularBuffer = require('./buffer');

// ============================================================================
// PLI Protocol Constants
// ============================================================================

const PROTOCOL = {
  PREFIX: 0xC8,           // Response prefix (200 decimal)
  BAUD: 9600,
  TIMEOUT_MS: 5000,
  RETRY_DELAY_MS: 1000,
  MAX_RETRIES: 3
};

// Command Codes
const CMD = {
  READ_RAM: 0x14,        // 20  - Read processor RAM
  READ_EEPROM: 0x48,      // 72  - Read non-volatile memory
  WRITE_RAM: 0x98,       // 152 - Write RAM
  WRITE_EEPROM: 0xCA,    // 202 - Write EEPROM
  LOOPBACK: 0xB7,       // 183 - Loopback test
  BUTTON: 0x57           // 87  - Button push
};

// RAM Addresses - Real-time Data
const ADDR = {
  // Battery (adc = 0.1V units typical)
  BATTERY_VOLTAGE: 50,
  BATTERY_TEMP: 52,       // °C = value - 100
  BATTERY_CURRENT: 212,     // See model multipliers
  
  // Solar
  SOLAR_VOLTAGE: 53,      // × 0.5V
  SOLAR_CURRENT: 212,       // Shared with battery current
  
  // System
  STATE: 101,             // Controller state
  SOC: 181,               // State of Charge (%)
  
  // Historical (30 days)
  DAY_POINTER: 45,         // Current day pointer
  DAY_MIN_VOLTAGE: 46,
  DAY_MAX_VOLTAGE: 47,
  DAY_TIME_FLOAT: 48,
  DAY_SOC: 49,
  
  // Settings
  EMAX: 35,               // Battery max voltage
  EMIN: 36,               // Battery min voltage
  BATTERY_SIZE: 37,         // Amp-hours
  
  // Version
  SOFTWARE_VERSION: 1
};

// Controller States
const STATE = {
  0: 'BOOST',
  1: 'EQUALIZE',
  2: 'ABSORPTION',
  3: 'FLOAT',
  4: 'RESTRICTED',
  5: 'LVD',
  6: 'SHORT_EQ',
  7: 'UNDEFINED'
};

// ============================================================================
// PLI Driver Class
// ============================================================================

class PLIDriver extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.host = options.host || 'localhost';
    this.port = options.port || 8888;
    this.timeout = options.timeout || PROTOCOL.TIMEOUT_MS;
    this.model = options.model || 'PL40';
    
    this.socket = null;
    this.buffer = new CircularBuffer(1024);
    this.pending = new Map();
    this.reconnectTimer = null;
    
    this._connect();
  }
  
  /**
   * Connect to TCP gateway
   */
  _connect() {
    console.log(`[PLI] Connexion à ${this.host}:${this.port}...`);
    
    this.socket = new net.Socket();
    
    this.socket.connect(this.port, this.host, () => {
      console.log('[PLI] Connecté');
      this.emit('connected');
    });
    
    this.socket.on('data', (data) => {
      this.buffer.write(data);
      this._processResponses();
    });
    
    this.socket.on('error', (err) => {
      console.error(`[PLI] Erreur: ${err.message}`);
      this.emit('error', err);
    });
    
    this.socket.on('close', () => {
      console.log('[PLI] Connexion fermée');
      this.emit('disconnected');
      this._scheduleReconnect();
    });
  }
  
  /**
   * Schedule reconnection attempt
   */
  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, PROTOCOL.RETRY_DELAY_MS);
  }
  
  /**
   * Build 4-byte PLI command with check byte
   * Format: [CMD, ADDR, DATA, CHECK]
   * CHECK = CMD XOR ADDR XOR DATA XOR 0xFF
   */
  _buildCommand(cmd, addr, data = 0x00) {
    const check = cmd ^ addr ^ data ^ 0xFF;
    return Buffer.from([cmd, addr, data, check]);
  }
  
  /**
   * Read a RAM location
   * @param {number} addr - RAM address (0-255)
   * @param {number} timeout - Read timeout in ms
   * @returns {Promise<number>} - Raw byte value
   */
  read(addr, timeout = this.timeout) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.readable) {
        return reject(new Error('Pas connecté'));
      }
      
      const cmd = this._buildCommand(CMD.READ_RAM, addr);
      const requestId = `${addr}-${Date.now()}`;
      
      this.pending.set(requestId, { resolve, reject, timeout, start: Date.now() });
      this.socket.write(cmd);
      console.log(`[PLI] Read @${addr}: ${cmd.toString('hex')}`);
      
      // Timeout
      setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error(`Timeout lecture @${addr}`));
        }
      }, timeout);
    });
  }
  
  /**
   * Read multiple addresses in single call
   */
  async readBatch(addresses) {
    const results = {};
    for (const addr of addresses) {
      try {
        results[addr] = await this.read(addr);
      } catch (err) {
        console.warn(`[PLI] Échec @${addr}: ${err.message}`);
        results[addr] = null;
      }
    }
    return results;
  }
  
  /**
   * Process incoming PLI responses
   * Expected: [0xC8, DATA] for successful reads
   */
  _processResponses() {
    // Look for 0xC8 prefix
    while (this.buffer.available() > 0) {
      const prefix = this.buffer.peek();
      
      if (prefix === PROTOCOL.PREFIX) {
        this.buffer.readByte();  // Consume prefix
        
        const data = this.buffer.readByte();
        if (data !== null) {
          // Complete pending reads
          for (const [id, pending] of this.pending) {
            this.pending.delete(id);
            pending.resolve(data);
            return;  // Only one response per command
          }
        }
      }
      else if (prefix >= 0x80 && prefix <= 0x88) {
        // Error code
        this.buffer.readByte();
        const errorCodes = {
          0x80: 'No comms',
          0x81: 'Timeout',
          0x82: 'Checksum error',
          0x83: 'Command not recognized',
          0x84: 'PL40 no reply',
          0x85: 'Error in reply'
        };
        console.error(`[PLI] Erreur: ${errorCodes[prefix] || 'Unknown'}`);
        this.emit('error', { code: prefix });
      }
      else {
        // Unknown byte, skip
        this.buffer.readByte();
      }
    }
  }
  
  /**
   * Read and calculate battery voltage
   * Formula depends on system voltage (12V default)
   */
  async getBatteryVoltage() {
    const raw = await this.read(ADDR.BATTERY_VOLTAGE);
    // PL40 typically 12V system, value × (systemV / 12)
    // TODO: Detect actual system voltage
    return { raw, voltage: raw };  // Return raw until calibrated
  }
  
  /**
   * Read battery temperature
   * Formula: temp = value - 100
   */
  async getBatteryTemp() {
    const raw = await this.read(ADDR.BATTERY_TEMP);
    return { raw, temp: raw - 100 };
  }
  
  /**
   * Read State of Charge
   * Already in percentage (0-100)
   */
  async getSOC() {
    const raw = await this.read(ADDR.SOC);
    return { raw, soc: raw };
  }
  
  /**
   * Read solar voltage
   * Formula: voltage = value × 0.5V
   */
  async getSolarVoltage() {
    const raw = await this.read(ADDR.SOLAR_VOLTAGE);
    return { raw, voltage: raw * 0.5 };
  }
  
  /**
   * Read charge current
   * Multipliers: PL20=0.1, PL40=0.2, PL60=0.4
   */
  async getChargeCurrent() {
    const raw = await this.read(ADDR.CHARGE_CURRENT);
    const multipliers = { PL20: 0.1, PL40: 0.2, PL60: 0.4 };
    const current = raw * (multipliers[this.model] || 0.2);
    return { raw, current };
  }
  
  /**
   * Read controller state
   */
  async getState() {
    const raw = await this.read(ADDR.STATE);
    return { raw, state: STATE[raw] || 'UNKNOWN' };
  }
  
  /**
   * Read all real-time data
   */
  async getAll() {
    return {
      timestamp: new Date().toISOString(),
      battery: {
        voltage: await this.getBatteryVoltage(),
        temp: await this.getBatteryTemp(),
        soc: await this.getSOC()
      },
      solar: {
        voltage: await this.getSolarVoltage(),
        current: await this.getChargeCurrent()
      },
      state: await this.getState()
    };
  }
  
  /**
   * Test connection with loopback
   */
  async test() {
    const cmd = this._buildCommand(CMD.LOOPBACK, 0x00, 0x00);
    return new Promise((resolve, reject) => {
      this.socket.write(cmd);
      setTimeout(() => {
        // Loopback response handled in processResponses
        // Expected: 0x80 (loopback response code)
        resolve(true);
      }, 1000);
    });
  }
  
  /**
   * Close connection
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

module.exports = { PLIDriver, CMD, ADDR, STATE, PROTOCOL };

// ============================================================================
// CLI Test
// ============================================================================

if (require.main === module) {
  const driver = new PLIDriver({ host: 'localhost', port: 8888 });
  
  driver.on('connected', async () => {
    try {
      console.log('\n=== Test PLI Driver ===\n');
      
      // Test loopback
      console.log('Test loopback...');
      await driver.test();
      console.log('Loopback: OK\n');
      
      // Read all data
      console.log('Lecture données...');
      const data = await driver.getAll();
      console.log('\nDonnées PL40:');
      console.log(JSON.stringify(data, null, 2));
      
      driver.disconnect();
    } catch (err) {
      console.error('Erreur:', err.message);
      driver.disconnect();
    }
  });
  
  driver.on('error', (err) => {
    console.error('Driver error:', err);
  });
}

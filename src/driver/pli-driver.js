/**
 * PLI Driver - Node.js driver for Plasmatronics PL40 Solar Controller
 * 
 * Communicate with PL40 via TCP gateway (Arduino + ESP8266)
 * 
 * Protocol:
 *   Commands: 4 bytes [CMD, ADDR, DATA, CHECK]
 *   Response: 2 bytes [0xC8, DATA] for reads
 *   Check: XOR of first 3 bytes XOR 0xFF
 */

const net = require('net');

// Configuration
const DEFAULT_HOST = process.env.PLI_HOST || 'localhost';
const DEFAULT_PORT = process.env.PLI_PORT || 8888;
const DEFAULT_TIMEOUT = 5000;  // ms

// PLI Command Codes
const CMD = {
  READ_RAM: 0x14,        // Read processor RAM (20 dec)
  READ_EEPROM: 0x48,      // Read EEPROM (72 dec)
  WRITE_RAM: 0x98,        // Write RAM (152 dec)
  WRITE_EEPROM: 0xCA,     // Write EEPROM (202 dec)
  LOOPBACK: 0xB7,         // Loopback test (183 dec)
  BUTTON: 0x57             // Button push (87 dec)
};

// RAM Addresses (key addresses for real-time data)
const ADDR = {
  BATTERY_VOLTAGE: 50,
  BATTERY_TEMP: 52,
  SOLAR_VOLTAGE: 53,
  CHARGE_CURRENT: 212,
  LOAD_CURRENT: 216,
  STATE: 101,
  SOC: 181,
  DAY_NUMBER: 0,
  SOFTWARE_VERSION: 1
};

// Controller States
const STATE = {
  0: 'BOOST',
  1: 'EQUALIZE',
  2: 'ABSORPTION',
  3: 'FLOAT',
  4: 'RESTRICTED',
  5: 'LVD'
};

// USB-Serial buffer
const CircularBuffer = require('./buffer');

// PLI Driver Class
class PLIDriver {
  constructor(options = {}) {
    this.host = options.host || DEFAULT_HOST;
    this.port = options.port || DEFAULT_PORT;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    
    this.socket = null;
    this.buffer = new CircularBuffer(1024);
    this.pendingReads = new Map();
    this.isConnected = false;
    
    this.reconnectDelay = 1000;
    this.maxRetries = 3;
  }
  
  /**
   * Connect to TCP gateway
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        return resolve();
      }
      
      this.socket = new net.Socket();
      
      this.socket.connect(this.port, this.host, () => {
        console.log(`[PLI] Connecté à ${this.host}:${this.port}`);
        this.isConnected = true;
        this.startReader();
        resolve();
      });
      
      this.socket.on('error', (err) => {
        console.error(`[PLI] Erreur: ${err.message}`);
        this.isConnected = false;
        reject(err);
      });
      
      this.socket.on('close', () => {
        console.log('[PLI] Connexion fermée');
        this.isConnected = false;
      });
      
      this.socket.on('data', (data) => {
        this.buffer.write(data);
        this.processResponses();
      });
    });
  }
  
  /**
   * Disconnect from gateway
   */
  disconnect() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
    this.isConnected = false;
  }
  
  /**
   * Build 4-byte PLI command with check byte
   */
  buildCommand(cmd, addr, data = 0x00) {
    const check = cmd ^ addr ^ data ^ 0xFF;
    return Buffer.from([cmd, addr, data, check]);
  }
  
  /**
   * Read a RAM/EEPROM location
   */
  read(addr, timeout = this.timeout) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        return reject(new Error('Pas connecté'));
      }
      
      const cmd = this.buildCommand(CMD.READ_RAM, addr);
      const id = Date.now() + Math.random();
      
      this.pendingReads.set(id, { resolve, reject, timeout });
      
      this.socket.write(cmd);
      console.log(`[PLI] Read @${addr}: ${cmd.toString('hex')}`);
      
      // Timeout cleanup
      setTimeout(() => {
        if (this.pendingReads.has(id)) {
          this.pendingReads.delete(id);
          reject(new Error(`Timeout lecture @${addr}`));
        }
      }, timeout);
    });
  }
  
  /**
   * Read multiple addresses in batch
   */
  async readBatch(addresses) {
    const results = {};
    for (const addr of addresses) {
      try {
        results[addr] = await this.read(addr);
      } catch (err) {
        results[addr] = null;
        console.warn(`[PLI] Échec lecture @${addr}: ${err.message}`);
      }
    }
    return results;
  }
  
  /**
   * Process incoming PLI responses
   * Expected format: [0xC8, DATA] for successful reads
   */
  processResponses() {
    // Cherche 0xC8 (200) dans le buffer
    let byte;
    while ((byte = this.buffer.read()) !== null) {
      if (byte === 0xC8) {
        // Prochier byte = donnée
        const data = this.buffer.read();
        if (data !== null) {
          // Trouve la lecture en attente la plus ancienne
          for (const [id, pending] of this.pendingReads) {
            this.pendingReads.delete(id);
            pending.resolve(data);
            return;
          }
        }
      }
      
      // Cherche autres réponses (loopback, erreurs)
      if (byte === 0x80) {
        const errorCode = this.buffer.read();
        if (errorCode !== null) {
          console.error(`[PLI] Erreur: 0x${byte.toString(16)} 0x${errorCode.toString(16)}`);
        }
      }
    }
  }
  
  // =========================================================================
  // High-level data accessors
  // =========================================================================
  
  /**
   * Read battery voltage (addr 50)
   * Formula: voltage = value × (systemVoltage / 12)
   * Default system: 12V
   */
  async readBatteryVoltage() {
    const raw = await this.read(ADDR.BATTERY_VOLTAGE);
    // TODO: Detect system voltage from settings
    const systemVoltage = 12;  // Default 12V, could be 24V or 48V
    return raw * (systemVoltage / 12);
  }
  
  /**
   * Read battery temperature (addr 52)
   * Formula: temp = value - 100
   */
  async readBatteryTemp() {
    const raw = await this.read(ADDR.BATTERY_TEMP);
    return raw - 100;
  }
  
  /**
   * Read State of Charge (addr 181)
   */
  async readSOC() {
    const raw = await this.read(ADDR.SOC);
    return raw;  // Already in percentage
  }
  
  /**
   * Read solar voltage (addr 53)
   * Formula: voltage = value × 0.5
   */
  async readSolarVoltage() {
    const raw = await this.read(ADDR.SOLAR_VOLTAGE);
    return raw * 0.5;
  }
  
  /**
   * Read charge current (addr 212)
   * Formula depends on model:
   *   PL20: current = value × 0.1
   *   PL40: current = value × 0.2
   *   PL60: current = value × 0.4
   */
  async readChargeCurrent(model = 'PL40') {
    const raw = await this.read(ADDR.CHARGE_CURRENT);
    const multipliers = { PL20: 0.1, PL40: 0.2, PL60: 0.4 };
    return raw * (multipliers[model] || 0.2);
  }
  
  /**
   * Read controller state (addr 101)
   */
  async readState() {
    const raw = await this.read(ADDR.STATE);
    return { code: raw, name: STATE[raw] || 'UNKNOWN' };
  }
  
  /**
   * Read all real-time data
   */
  async readAll() {
    return {
      timestamp: new Date(),
      battery: {
        voltage: await this.readBatteryVoltage(),
        temp: await this.readBatteryTemp(),
        soc: await this.readSOC()
      },
      solar: {
        voltage: await this.readSolarVoltage(),
        current: await this.readChargeCurrent()
      },
      state: await this.readState()
    };
  }
}

// Export
module.exports = { PLIDriver, CMD, ADDR, STATE };

// CLI Test
if (require.main === module) {
  const driver = new PLIDriver({ host: 'localhost', port: 8888 });
  
  async function test() {
    try {
      await driver.connect();
      console.log('Lecture tension batterie...');
      const voltage = await driver.readBatteryVoltage();
      console.log(`Tension: ${voltage.toFixed(1)}V`);
      
      const all = await driver.readAll();
      console.log('Données complètes:', JSON.stringify(all, null, 2));
      
      driver.disconnect();
    } catch (err) {
      console.error('Erreur:', err.message);
    }
  }
  
  test();
}

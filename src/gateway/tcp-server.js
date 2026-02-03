/**
 * TCP Server for PLI Gateway
 * 
 * Écoute les connexions du gateway Arduino et relaie les données
 * vers/depuis le driver PLI
 */

const net = require('net');
const { Writable } = require('stream');

// Configuration
const TCP_PORT = process.env.PLI_TCP_PORT || 8888;
const HOST = process.env.PLI_HOST || '0.0.0.0';

// Buffer pour données entrantes
class CircularBuffer {
  constructor(size) {
    this.buffer = Buffer.alloc(size);
    this.head = 0;
    this.tail = 0;
    this.size = size;
    this.count = 0;
  }
  
  write(data) {
    for (let byte of data) {
      this.buffer[this.head] = byte;
      this.head = (this.head + 1) % this.size;
      if (this.count < this.size) {
        this.count++;
      } else {
        this.tail = (this.tail + 1) % this.size;
      }
    }
  }
  
  read() {
    if (this.count === 0) return null;
    const byte = this.buffer[this.tail];
    this.tail = (this.tail + 1) % this.size;
    this.count--;
    return byte;
  }
  
  available() {
    return this.count;
  }
}

// Server instance
let server = null;
let gatewayClient = null;
let isRunning = false;

// Stats
let stats = {
  connections: 0,
  bytesReceived: 0,
  bytesSent: 0,
  errors: 0,
  lastActivity: null
};

function createServer() {
  server = net.createServer({ allowHalfOpen: true }, (socket) => {
    console.log(`[TCP] Nouvelle connexion: ${socket.remoteAddress}:${socket.remotePort}`);
    
    gatewayClient = socket;
    stats.connections++;
    stats.lastActivity = new Date();
    
    // Reset buffer
    const inputBuffer = new CircularBuffer(1024);
    
    socket.on('data', (data) => {
      stats.bytesReceived += data.length;
      stats.lastActivity = new Date();
      
      // Route vers stdout (pour debug/pipe vers driver)
      process.stdout.write(data);
      
      // Réponse heartbeat si demandé
      if (data.toString().includes('PING')) {
        socket.write('PONG\n');
      }
    });
    
    socket.on('error', (err) => {
      console.error(`[TCP] Erreur: ${err.message}`);
      stats.errors++;
      gatewayClient = null;
    });
    
    socket.on('end', () => {
      console.log('[TCP] Gateway déconnecté');
      gatewayClient = null;
    });
    
    socket.on('close', () => {
      console.log('[TCP] Connexion fermée');
      gatewayClient = null;
    });
    
    // Timeout inactivity (5 minutes)
    socket.setTimeout(300000, () => {
      console.log('[TCP] Timeout - déconnexion');
      socket.end();
    });
  });
  
  server.on('error', (err) => {
    console.error(`[TCP] Erreur serveur: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.log(`[TCP] Port ${TCP_PORT} déjà utilisé`);
    }
  });
  
  return server;
}

function start() {
  if (isRunning) {
    console.log('[TCP] Serveur déjà en cours');
    return;
  }
  
  server = createServer();
  
  server.listen(TCP_PORT, HOST, () => {
    isRunning = true;
    console.log(`[TCP] Serveur PLI Gateway démarré sur ${HOST}:${TCP_PORT}`);
  });
}

function stop() {
  if (gatewayClient) {
    gatewayClient.end();
    gatewayClient = null;
  }
  if (server) {
    server.close();
    server = null;
  }
  isRunning = false;
  console.log('[TCP] Serveur arrêté');
}

function send(data) {
  if (!gatewayClient || !gatewayClient.writable) {
    throw new Error('Pas de gateway connecté');
  }
  
  gatewayClient.write(data);
  stats.bytesSent += data.length;
  stats.lastActivity = new Date();
}

function getStats() {
  return {
    ...stats,
    connected: gatewayClient !== null,
    uptime: isRunning ? Date.now() - (stats.startTime || Date.now()) : 0
  };
}

// Export pour utilisation comme module
module.exports = {
  start,
  stop,
  send,
  getStats,
  isRunning: () => isRunning
};

// CLI
if (require.main === module) {
  console.log('=== TCP Server pour PLI Gateway ===\n');
  
  start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[TCP] Arrêt...');
    stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    stop();
    process.exit(0);
  });
}

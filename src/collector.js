/**
 * Data Collector - Collect and store PL40 readings
 * 
 * Scheduled collection and SQLite storage
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Configuration
const DB_PATH = process.env.PLI_DB_PATH || './data/pl40.db';
const COLLECTION_INTERVAL = 30000;  // 30 seconds

// Database
let db = null;

/**
 * Initialize SQLite database
 */
function initDB() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  db = new sqlite3.Database(DB_PATH);
  
  db.serialize(() => {
    // Table readings
    db.run(`
      CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        battery_voltage REAL,
        battery_temp REAL,
        battery_soc INTEGER,
        solar_voltage REAL,
        solar_current REAL,
        charge_current REAL,
        load_current REAL,
        state TEXT,
        raw_data TEXT
      )
    `);
    
    // Index for fast queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON readings(timestamp)`);
  });
  
  console.log(`[DB] Base de données: ${DB_PATH}`);
}

/**
 * Store a reading
 */
function storeReading(data) {
  if (!db) return;
  
  const stmt = db.prepare(`
    INSERT INTO readings (
      battery_voltage, battery_temp, battery_soc,
      solar_voltage, solar_current, charge_current,
      load_current, state, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    data.battery?.voltage || null,
    data.battery?.temp || null,
    data.battery?.soc || null,
    data.solar?.voltage || null,
    data.solar?.current || null,
    data.charge?.current || null,
    data.load?.current || null,
    data.state?.name || null,
    JSON.stringify(data)
  );
  
  stmt.finalize();
  
  console.log(`[DB] Lecture stockée: ${JSON.stringify(data)}`);
}

/**
 * Get readings in time range
 */
function getReadings(startTime, endTime) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM readings WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp`,
      [startTime, endTime],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

/**
 * Get latest reading
 */
function getLatest() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1`,
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

/**
 * Get daily summary
 */
function getDailySummary(date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return new Promise((resolve, reject) => {
    db.get(`
      SELECT 
        MIN(battery_voltage) as min_voltage,
        MAX(battery_voltage) as max_voltage,
        AVG(battery_voltage) as avg_voltage,
        MIN(battery_soc) as min_soc,
        MAX(battery_soc) as max_soc,
        AVG(solar_voltage) as avg_solar_voltage,
        COUNT(*) as readings
      FROM readings 
      WHERE timestamp BETWEEN ? AND ?
    `, [startOfDay.toISOString(), endOfDay.toISOString()],
    (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

/**
 * Clean old readings (keep last 30 days)
 */
function cleanupOld() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  
  db.run(`DELETE FROM readings WHERE timestamp < ?`, [cutoff.toISOString()]);
  console.log(`[DB] Nettoyage: anciennes données supprimées`);
}

/**
 * Close database
 */
function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}

// Export
module.exports = {
  initDB,
  storeReading,
  getReadings,
  getLatest,
  getDailySummary,
  cleanupOld,
  closeDB
};

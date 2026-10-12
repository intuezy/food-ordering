const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'kitchen.db');
const db = new Database(dbPath);

// Aktifkan foreign key enforcement
db.pragma('foreign_keys = ON');

// Jalankan skema DDL awal dari schema.sql
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

module.exports = db;

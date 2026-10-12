const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'kitchen.db');
const db = new Database(dbPath);

// Aktifkan foreign key
db.pragma('foreign_keys = ON');

// Inisialisasi skema tabel dapur (PENTING: Tidak ada kolom harga/finansial)
db.exec(`
  CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    correlation_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_KITCHEN',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ticket_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES kitchen_tickets(id) ON DELETE CASCADE
  );
`);

module.exports = db;

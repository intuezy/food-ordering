const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'orders.db');
const db = new Database(dbPath);

// Aktifkan foreign key
db.pragma('foreign_keys = ON');

// Inisialisasi tabel skema orders
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    total_price REAL NOT NULL,
    kitchen_ticket_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

module.exports = db;

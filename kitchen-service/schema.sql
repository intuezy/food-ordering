-- Skema Database: Kitchen Service (kitchen.db)
-- Catatan EAI: Dapur HANYA mencatat instruksi produksi (tanpa kolom harga/finansial).

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

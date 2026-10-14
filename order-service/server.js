const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const KITCHEN_SERVICE_URL = process.env.KITCHEN_SERVICE_URL || 'http://localhost:3002';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Logger request
app.use((req, res, next) => {
  console.log(`[OrderService] ${req.method} ${req.url}`);
  next();
});

// Route utama UI Kasir
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================================================
// TUGAS DEV 1: ORDER SERVICE (PORT 3001)
// Rujukan format request/response: docs/API_CONTRACT.md
// ==============================================================================

// 1. POST /api/orders
// Buat pesanan baru dari kasir & dispatch ke Kitchen Service
app.post('/api/orders', async (req, res) => {
  const { customer_name, items } = req.body;

  // Validasi input
  if (!customer_name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: 'customer_name dan items (array tidak kosong) wajib diisi',
    });
  }

  let orderId;
  try {
    // Hitung total_price
    let total_price = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      total_price += price * qty;
    }

    // Transaksi: simpan order dan order_items
    const insertOrder = db.prepare(
      'INSERT INTO orders (customer_name, status, total_price) VALUES (?, ?, ?)'
    );
    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, item_name, quantity, price) VALUES (?, ?, ?, ?)'
    );

    const transaction = db.transaction(() => {
      const result = insertOrder.run(customer_name, 'PENDING', total_price);
      orderId = result.lastInsertRowid;
      for (const item of items) {
        insertItem.run(
          orderId,
          item.item_name,
          item.quantity,
          item.price
        );
      }
    });

    transaction();

    // Siapkan payload untuk kitchen (tanpa harga)
    const kitchenItems = items.map((item) => ({
      item_name: item.item_name,
      quantity: item.quantity,
    }));

    let kitchenTicketId = null;

    try {
      const kitchenRes = await fetch(
        `${KITCHEN_SERVICE_URL}/api/kitchen/tickets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            correlation_id: orderId,
            order_id: orderId,
            customer_name,
            items: kitchenItems,
          }),
        }
      );
      if (kitchenRes.ok || kitchenRes.status === 201) {
        const kitchenData = await kitchenRes.json();
        kitchenTicketId = kitchenData.ticket_id || null;
        // Update status order menjadi IN_KITCHEN
        db.prepare('UPDATE orders SET status = ?, kitchen_ticket_id = ? WHERE id = ?')
          .run('IN_KITCHEN', kitchenTicketId, orderId);
      }
    } catch (err) {
      console.error('[OrderService] Gagal mengirim dispatch ke kitchen:', err.message);
      // Jika kitchen gagal, status tetap PENDING sesuai desain - tapi tetap return order
    }

    // Ambil order yang baru dibuat beserta items
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT item_name, quantity, price FROM order_items WHERE order_id = ?').all(orderId);

    return res.status(201).json({
      order_id: order.id,
      customer_name: order.customer_name,
      status: order.status,
      total_price: order.total_price,
      kitchen_ticket_id: order.kitchen_ticket_id,
      items: orderItems,
      created_at: order.created_at,
    });
  } catch (error) {
    console.error('[OrderService] Error saat membuat order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// 2. GET /api/orders
// Ambil semua daftar pesanan beserta items-nya
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    const itemsStmt = db.prepare('SELECT item_name, quantity, price FROM order_items WHERE order_id = ?');
    const result = orders.map((order) => ({
      id: order.id,
      customer_name: order.customer_name,
      status: order.status,
      total_price: order.total_price,
      items: itemsStmt.all(order.id),
      created_at: order.created_at,
    }));
    return res.status(200).json(result);
  } catch (error) {
    console.error('[OrderService] Error saat mengambil orders:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// 3. GET /api/orders/:id
// Ambil detail 1 pesanan berdasarkan ID
app.get('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }
    const items = db.prepare('SELECT item_name, quantity, price FROM order_items WHERE order_id = ?').all(orderId);
    return res.status(200).json({
      id: order.id,
      customer_name: order.customer_name,
      status: order.status,
      total_price: order.total_price,
      items,
      created_at: order.created_at,
    });
  } catch (error) {
    console.error('[OrderService] Error saat mengambil order:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// 4. PATCH /api/orders/:id/status
// Menerima Callback perubahan status dari Kitchen Service (e.g., COOKING, READY_FOR_PICKUP)
app.patch('/api/orders/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  const VALID_STATUSES = ['PENDING', 'IN_KITCHEN', 'COOKING', 'READY_FOR_PICKUP'];
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `status wajib diisi (${VALID_STATUSES.join(', ')})`,
    });
  }

  try {
    const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Order tidak ditemukan' });
    }
    return res.status(200).json({
      success: true,
      order_id: Number(orderId),
      new_status: status,
    });
  } catch (error) {
    console.error('[OrderService] Error saat update status:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[OrderService] Server aktif di http://localhost:${PORT}`);
});

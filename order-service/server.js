const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const KITCHEN_SERVICE_URL = process.env.KITCHEN_SERVICE_URL || 'http://localhost:3002';

app.use(cors());
app.use(express.json());

// Log sederhana untuk tracing request integrasi
app.use((req, res, next) => {
  console.log(`[OrderService] ${req.method} ${req.url}`);
  next();
});

// 1. POST /api/orders - Buat pesanan baru & dispatch ke Kitchen Service
app.post('/api/orders', async (req, res) => {
  const { customer_name, items } = req.body;

  if (!customer_name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customer_name dan items (array) wajib diisi' });
  }

  try {
    const totalPrice = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);

    const insertOrder = db.prepare(`
      INSERT INTO orders (customer_name, status, total_price)
      VALUES (?, 'PENDING', ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, item_name, quantity, price)
      VALUES (?, ?, ?, ?)
    `);

    // Simpan order & item dalam satu transaksi
    const orderTx = db.transaction(() => {
      const info = insertOrder.run(customer_name, totalPrice);
      const orderId = info.lastInsertRowid;
      for (const item of items) {
        insertItem.run(orderId, item.item_name, item.quantity, item.price);
      }
      return orderId;
    });

    const orderId = orderTx();

    // Integrasi EAI (Order Dispatch ke Kitchen Service)
    // PENTING: Dapur hanya menerima data produksi (tanpa harga)
    let kitchenTicketId = null;
    let currentStatus = 'PENDING';

    try {
      const dispatchPayload = {
        correlation_id: orderId,
        order_id: orderId,
        customer_name,
        items: items.map(it => ({
          item_name: it.item_name,
          quantity: it.quantity
        }))
      };

      const kitchenResponse = await fetch(`${KITCHEN_SERVICE_URL}/api/kitchen/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispatchPayload)
      });

      if (kitchenResponse.ok) {
        const kitchenData = await kitchenResponse.json();
        kitchenTicketId = kitchenData.ticket_id;
        currentStatus = 'IN_KITCHEN';

        db.prepare('UPDATE orders SET status = ?, kitchen_ticket_id = ? WHERE id = ?')
          .run(currentStatus, kitchenTicketId, orderId);
      } else {
        console.warn(`[OrderService] Gagal dispatch ke kitchen (status ${kitchenResponse.status})`);
      }
    } catch (err) {
      console.warn('[OrderService] Kitchen service tidak merespons (offline):', err.message);
    }

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    return res.status(201).json({
      ...createdOrder,
      items: orderItems
    });
  } catch (error) {
    console.error('[OrderService] Error create order:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/orders - Ambil semua pesanan
app.get('/api/orders', (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    const result = orders.map(order => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      return { ...order, items };
    });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. GET /api/orders/:id - Ambil detail 1 pesanan
app.get('/api/orders/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    return res.json({ ...order, items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. PATCH /api/orders/:id/status - Menerima Callback status dari Kitchen Service
app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const orderId = req.params.id;

  if (!status) {
    return res.status(400).json({ error: 'Status wajib diisi' });
  }

  try {
    const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Order tidak ditemukan' });
    }

    console.log(`[OrderService] Callback diterima: Order #${orderId} diupdate menjadi status ${status}`);
    return res.json({
      success: true,
      order_id: Number(orderId),
      new_status: status
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[OrderService] Aktif di http://localhost:${PORT}`);
});

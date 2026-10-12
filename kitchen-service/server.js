const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// Log sederhana untuk tracing request integrasi
app.use((req, res, next) => {
  console.log(`[KitchenService] ${req.method} ${req.url}`);
  next();
});

// 1. POST /api/kitchen/tickets - Menerima dispatch tiket order dari Order Service
app.post('/api/kitchen/tickets', (req, res) => {
  const { correlation_id, order_id, customer_name, items } = req.body;

  if (!order_id || !customer_name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'order_id, customer_name, dan items wajib diisi' });
  }

  try {
    const insertTicket = db.prepare(`
      INSERT INTO kitchen_tickets (order_id, correlation_id, customer_name, status)
      VALUES (?, ?, ?, 'IN_KITCHEN')
    `);
    const insertItem = db.prepare(`
      INSERT INTO ticket_items (ticket_id, item_name, quantity)
      VALUES (?, ?, ?)
    `);

    const ticketTx = db.transaction(() => {
      const info = insertTicket.run(order_id, correlation_id || order_id, customer_name);
      const ticketId = info.lastInsertRowid;
      for (const item of items) {
        insertItem.run(ticketId, item.item_name, item.quantity);
      }
      return ticketId;
    });

    const ticketId = ticketTx();

    console.log(`[KitchenService] Tiket #${ticketId} diterima untuk Order #${order_id} (${customer_name})`);

    // Response Order Acceptance Reply (201)
    return res.status(201).json({
      ticket_id: ticketId,
      correlation_id: correlation_id || order_id,
      status: 'ACCEPTED',
      message: 'Tiket berhasil masuk ke antrean dapur'
    });
  } catch (error) {
    console.error('[KitchenService] Error create ticket:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/kitchen/tickets - Ambil daftar tiket antrean dapur
app.get('/api/kitchen/tickets', (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM kitchen_tickets';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY id ASC';

    const tickets = db.prepare(query).all(...params);
    const result = tickets.map(ticket => {
      const items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ?').all(ticket.id);
      return { ...ticket, items };
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. PATCH /api/kitchen/tickets/:id/status - Update status masak & kirim callback ke Order Service
app.patch('/api/kitchen/tickets/:id/status', async (req, res) => {
  const { status } = req.body;
  const ticketId = req.params.id;

  if (!status) {
    return res.status(400).json({ error: 'Status wajib diisi (contoh: COOKING, READY_FOR_PICKUP)' });
  }

  try {
    const ticket = db.prepare('SELECT * FROM kitchen_tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }

    db.prepare('UPDATE kitchen_tickets SET status = ? WHERE id = ?').run(status, ticketId);
    console.log(`[KitchenService] Status tiket #${ticketId} diupdate menjadi ${status}`);

    // Integrasi EAI: Kirim Status Callback Event ke Order Service
    let callbackSent = false;
    try {
      const callbackResponse = await fetch(`${ORDER_SERVICE_URL}/api/orders/${ticket.order_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (callbackResponse.ok) {
        callbackSent = true;
        console.log(`[KitchenService] Callback berhasil terkirim ke OrderService untuk Order #${ticket.order_id}`);
      } else {
        console.warn(`[KitchenService] OrderService merespons status ${callbackResponse.status} saat callback`);
      }
    } catch (err) {
      console.warn('[KitchenService] Gagal kirim callback (OrderService offline?):', err.message);
    }

    return res.json({
      success: true,
      ticket_id: Number(ticketId),
      order_id: ticket.order_id,
      status,
      callback_sent: callbackSent
    });
  } catch (error) {
    console.error('[KitchenService] Error update status:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[KitchenService] Aktif di http://localhost:${PORT}`);
});

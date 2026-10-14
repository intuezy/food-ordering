const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// Serve static frontend UI (Kitchen Display System)
app.use(express.static(path.join(__dirname, 'public')));

// Logger request
app.use((req, res, next) => {
  console.log(`[KitchenService] ${req.method} ${req.url}`);
  next();
});

// Route utama melayani UI Dapur
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==============================================================================
// TUGAS DEV 2: KITCHEN SERVICE (PORT 3002)
// Rujukan format request/response: docs/API_CONTRACT.md
// ==============================================================================

// 1. POST /api/kitchen/tickets
// Menerima Order Dispatch dari Order Service untuk antrean dapur
app.post('/api/kitchen/tickets', (req, res) => {
  try {
    const { correlation_id, order_id, customer_name, items } = req.body;

    // 1. Validasi input: pastikan order_id, customer_name, dan items (array) ada.
    if (!order_id || !customer_name || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'order_id, customer_name, dan items (array non-empty) wajib diisi'
      });
    }

    // 2. Simpan tiket ke tabel `kitchen_tickets` dengan status default 'IN_KITCHEN',
    //    order_id, correlation_id, dan customer_name.
    // 3. Simpan setiap item ke tabel `ticket_items` (hanya item_name dan quantity, tanpa harga).
    //    Dibungkus transaction biar atomic: kalau insert item gagal, tiket ikut rollback.
    const insertTicket = db.prepare(`
      INSERT INTO kitchen_tickets (order_id, correlation_id, customer_name, status)
      VALUES (?, ?, ?, 'IN_KITCHEN')
    `);
    const insertItem = db.prepare(`
      INSERT INTO ticket_items (ticket_id, item_name, quantity)
      VALUES (?, ?, ?)
    `);

    const createTicket = db.transaction((payload) => {
      const info = insertTicket.run(
        payload.order_id,
        payload.correlation_id ?? payload.order_id, // fallback: correlation_id = order_id
        payload.customer_name
      );
      const ticketId = info.lastInsertRowid;
      for (const item of payload.items) {
        if (!item.item_name || !item.quantity) {
          throw new Error('Setiap item wajib punya item_name dan quantity');
        }
        insertItem.run(ticketId, item.item_name, item.quantity);
      }
      return ticketId;
    });

    const ticketId = createTicket({ order_id, correlation_id, customer_name, items });

    // 4. Kembalikan response HTTP 201 (Order Acceptance Reply)
    return res.status(201).json({
      ticket_id: Number(ticketId),
      correlation_id: correlation_id ?? order_id,
      status: 'ACCEPTED',
      message: 'Tiket berhasil masuk ke antrean dapur'
    });
  } catch (err) {
    console.error('[KitchenService] Error POST /api/kitchen/tickets:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// 2. GET /api/kitchen/tickets
// Ambil semua daftar tiket antrean di dapur (opsional filter query ?status=...)
app.get('/api/kitchen/tickets', (req, res) => {
  try {
    const { status } = req.query;

    // 1. Query daftar tiket dari tabel `kitchen_tickets` (jika ada param `status`, filter berdasarkan status).
    // 3. Urutkan berdasarkan tiket yang paling lama mengantre (ORDER BY id ASC).
    let tickets;
    if (status) {
      tickets = db.prepare('SELECT * FROM kitchen_tickets WHERE status = ? ORDER BY id ASC').all(status);
    } else {
      tickets = db.prepare('SELECT * FROM kitchen_tickets ORDER BY id ASC').all();
    }

    // 2. Sertakan items dari `ticket_items` untuk tiap tiket (hanya item_name & quantity).
    const getItems = db.prepare('SELECT item_name, quantity FROM ticket_items WHERE ticket_id = ? ORDER BY id ASC');
    const result = tickets.map((t) => ({
      ...t,
      items: getItems.all(t.id)
    }));

    // 4. Kembalikan response JSON HTTP 200.
    return res.status(200).json(result);
  } catch (err) {
    console.error('[KitchenService] Error GET /api/kitchen/tickets:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

// 3. PATCH /api/kitchen/tickets/:id/status
// Update status tiket masak & tembak Status Callback Event ke Order Service
app.patch('/api/kitchen/tickets/:id/status', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status } = req.body;

    // 1. Validasi input: pastikan `status` ada dan valid.
    const VALID_STATUSES = ['IN_KITCHEN', 'COOKING', 'READY_FOR_PICKUP'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `status wajib diisi dan harus salah satu dari: ${VALID_STATUSES.join(', ')}`
      });
    }

    // 2. Cari tiket di tabel `kitchen_tickets` WHERE id = ticketId. Jika tidak ditemukan, return 404.
    const ticket = db.prepare('SELECT * FROM kitchen_tickets WHERE id = ?').get(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: `Tiket dengan id ${ticketId} tidak ditemukan` });
    }

    // 3. Update status tiket di `kitchen_tickets` menjadi status baru.
    db.prepare('UPDATE kitchen_tickets SET status = ? WHERE id = ?').run(status, ticketId);

    // 4. Integrasi EAI (Status Callback Event) -> Order Service.
    //    Pakai try/catch + timeout agar kalau Order Service offline, service ini tidak crash.
    let callbackSent = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // timeout 5 detik

      const resp = await fetch(`${ORDER_SERVICE_URL}/api/orders/${ticket.order_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      callbackSent = resp.ok;
      if (!resp.ok) {
        console.error(`[KitchenService] Callback ke Order Service gagal: HTTP ${resp.status}`);
      }
    } catch (callbackErr) {
      console.error('[KitchenService] Order Service offline / callback error:', callbackErr.message);
    }

    // 5. Kembalikan response HTTP 200.
    return res.status(200).json({
      success: true,
      ticket_id: Number(ticketId),
      order_id: ticket.order_id,
      status,
      callback_sent: callbackSent
    });
  } catch (err) {
    console.error('[KitchenService] Error PATCH /api/kitchen/tickets/:id/status:', err.message);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[KitchenService] Server aktif di http://localhost:${PORT}`);
});

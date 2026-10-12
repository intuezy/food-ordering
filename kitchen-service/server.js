const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// Logger request
app.use((req, res, next) => {
  console.log(`[KitchenService] ${req.method} ${req.url}`);
  next();
});

// ==============================================================================
// TUGAS DEV 2: KITCHEN SERVICE (PORT 3002)
// Rujukan format request/response: docs/API_CONTRACT.md
// ==============================================================================

// 1. POST /api/kitchen/tickets
// Menerima Order Dispatch dari Order Service untuk antrean dapur
app.post('/api/kitchen/tickets', (req, res) => {
  const { correlation_id, order_id, customer_name, items } = req.body;

  // TODO [Dev 2]:
  // 1. Validasi input: pastikan order_id, customer_name, dan items (array) ada.
  // 2. Simpan tiket ke tabel `kitchen_tickets` dengan status default 'IN_KITCHEN',
  //    order_id, correlation_id, dan customer_name.
  // 3. Simpan setiap item ke tabel `ticket_items` (hanya item_name dan quantity, tanpa harga).
  // 4. Kembalikan response HTTP 201 (Order Acceptance Reply):
  //    { ticket_id, correlation_id, status: 'ACCEPTED', message: 'Tiket berhasil masuk ke antrean dapur' }

  res.status(501).json({ message: 'TODO: Dev 2 silakan implementasikan POST /api/kitchen/tickets' });
});

// 2. GET /api/kitchen/tickets
// Ambil semua daftar tiket antrean di dapur (opsional filter query ?status=...)
app.get('/api/kitchen/tickets', (req, res) => {
  const { status } = req.query;

  // TODO [Dev 2]:
  // 1. Query daftar tiket dari tabel `kitchen_tickets` (jika ada param `status`, filter berdasarkan status).
  // 2. Sertakan items dari `ticket_items` untuk tiap tiket.
  // 3. Urutkan berdasarkan tiket yang paling lama mengantre (ORDER BY id ASC).
  // 4. Kembalikan response JSON HTTP 200.

  res.status(501).json({ message: 'TODO: Dev 2 silakan implementasikan GET /api/kitchen/tickets' });
});

// 3. PATCH /api/kitchen/tickets/:id/status
// Update status tiket masak & tembak Status Callback Event ke Order Service
app.patch('/api/kitchen/tickets/:id/status', async (req, res) => {
  const ticketId = req.params.id;
  const { status } = req.body;

  // TODO [Dev 2]:
  // 1. Validasi input: pastikan `status` ada (contoh valid: 'COOKING', 'READY_FOR_PICKUP').
  // 2. Cari tiket di tabel `kitchen_tickets` WHERE id = ticketId. Jika tidak ditemukan, return 404.
  // 3. Update status tiket di `kitchen_tickets` menjadi status baru.
  // 4. Integrasi EAI (Status Callback Event):
  //    - Kirim HTTP PATCH fetch ke `${ORDER_SERVICE_URL}/api/orders/${ticket.order_id}/status`
  //    - Bawa body: { status }
  //    - Tangani jika Order Service offline (gunakan try/catch agar tidak crash).
  // 5. Kembalikan response HTTP 200:
  //    { success: true, ticket_id: Number(ticketId), order_id: ticket.order_id, status, callback_sent: true }

  res.status(501).json({ message: 'TODO: Dev 2 silakan implementasikan PATCH /api/kitchen/tickets/:id/status' });
});

app.listen(PORT, () => {
  console.log(`[KitchenService] Server aktif di http://localhost:${PORT}`);
});

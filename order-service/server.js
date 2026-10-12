const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const KITCHEN_SERVICE_URL = process.env.KITCHEN_SERVICE_URL || 'http://localhost:3002';

app.use(cors());
app.use(express.json());

// Logger request
app.use((req, res, next) => {
  console.log(`[OrderService] ${req.method} ${req.url}`);
  next();
});

// ==============================================================================
// TUGAS DEV 1: ORDER SERVICE (PORT 3001)
// Rujukan format request/response: docs/API_CONTRACT.md
// ==============================================================================

// 1. POST /api/orders
// Buat pesanan baru dari kasir & dispatch ke Kitchen Service
app.post('/api/orders', async (req, res) => {
  const { customer_name, items } = req.body;

  // TODO [Dev 1]:
  // 1. Validasi input: pastikan customer_name ada dan items berbentuk array tidak kosong.
  // 2. Hitung total_price dari seluruh item (price * quantity).
  // 3. Simpan data pesanan ke tabel `orders` (status awal: 'PENDING') menggunakan db.prepare().
  // 4. Simpan setiap item ke tabel `order_items` dengan `order_id` yang didapat.
  // 5. Integrasi EAI (Order Dispatch):
  //    - Kirim HTTP POST fetch ke `${KITCHEN_SERVICE_URL}/api/kitchen/tickets`
  //    - Bawa payload: { correlation_id: orderId, order_id: orderId, customer_name, items }
  //    - PERHATIAN: Jangan sertakan kolom harga/price saat kirim ke dapur!
  //    - Jika kitchen berhasil menerima (status 201), update status order di orders.db menjadi 'IN_KITCHEN'
  //      dan simpan kitchen_ticket_id yang dikembalikan dapur.
  // 6. Kembalikan response HTTP 201 berisi detail order yang dibuat.

  res.status(501).json({ message: 'TODO: Dev 1 silakan implementasikan POST /api/orders' });
});

// 2. GET /api/orders
// Ambil semua daftar pesanan beserta items-nya
app.get('/api/orders', (req, res) => {
  // TODO [Dev 1]:
  // 1. Query semua baris dari tabel `orders` diurutkan dari yang terbaru (ORDER BY id DESC).
  // 2. Sertakan items dari `order_items` untuk setiap order.
  // 3. Kembalikan response JSON HTTP 200.

  res.status(501).json({ message: 'TODO: Dev 1 silakan implementasikan GET /api/orders' });
});

// 3. GET /api/orders/:id
// Ambil detail 1 pesanan berdasarkan ID
app.get('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;

  // TODO [Dev 1]:
  // 1. Query tabel `orders` WHERE id = orderId.
  // 2. Jika tidak ada, kembalikan response 404 (Order tidak ditemukan).
  // 3. Query items dari `order_items` WHERE order_id = orderId.
  // 4. Kembalikan response JSON HTTP 200 berisi data order + items.

  res.status(501).json({ message: 'TODO: Dev 1 silakan implementasikan GET /api/orders/:id' });
});

// 4. PATCH /api/orders/:id/status
// Menerima Callback perubahan status dari Kitchen Service (e.g., COOKING, READY_FOR_PICKUP)
app.patch('/api/orders/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;

  // TODO [Dev 1]:
  // 1. Validasi input: pastikan `status` ada.
  // 2. Update status order di tabel `orders` WHERE id = orderId.
  // 3. Jika orderId tidak ditemukan, kembalikan 404.
  // 4. Kembalikan response HTTP 200 { success: true, order_id: Number(orderId), new_status: status }.

  res.status(501).json({ message: 'TODO: Dev 1 silakan implementasikan PATCH /api/orders/:id/status' });
});

app.listen(PORT, () => {
  console.log(`[OrderService] Server aktif di http://localhost:${PORT}`);
});

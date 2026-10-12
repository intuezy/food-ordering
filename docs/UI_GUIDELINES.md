# Panduan Desain & Kebutuhan UI/UX (Alda Dwi Agustina)

> **Mata Kuliah:** Enterprise Architecture Integration (EAI)  
> **Prinsip Utama:** Sistem terbagi menjadi **2 Layar Terpisah** yang berjalan di service masing-masing.

---

## 🖥️ 1. Layar A: UI Kasir (Order Service - `:3001`)

Digunakan oleh staf kasir di meja depan untuk mencatat pesanan pelanggan dan memantau status pesanan.

### Komponen yang Wajib Ada:
1. **Form / Katalog Pemesanan:**
   - Input Nama Pelanggan (`customer_name`).
   - Pilihan Menu (Nama Item & Harga).
   - Input Jumlah Porsi / Kuantitas (`quantity`).
   - Keranjang Ringkasan Pesanan (Daftar item terpilih, subtotal harga, total bayar).
   - Tombol **"Kirim Pesanan ke Dapur"** (Aksi trigger `POST /api/orders`).
2. **Tabel / Kartu Monitor Status Pesanan:**
   - Menampilkan daftar pesanan yang sedang aktif.
   - Kolom: ID Pesanan, Nama Pelanggan, Total Harga, Waktu Pesan.
   - **Badge Status Real-time:**
     - 🟡 `PENDING` (Baru dibuat)
     - 🔵 `IN_KITCHEN` (Diterima dapur)
     - 🟠 `COOKING` (Sedang dimasak koki)
     - 🟢 `READY_FOR_PICKUP` (Makanan siap diambil pelanggan)

---

## 🍳 2. Layar B: UI Monitor Dapur (Kitchen Service - `:3002`)

Digunakan oleh koki di dapur (disebut juga **KDS / Kitchen Display System**).

### Komponen yang Wajib Ada:
1. **Papan Antrean Tiket (Kanban / Card Grid):**
   - Setiap kartu tiket mewakili 1 pesanan (`ticket_id` & `order_id`).
   - Informasi kartu:
     - Nomor Tiket / ID Pesanan.
     - Nama Pelanggan.
     - Daftar Item & Jumlah Porsi (Contoh: `2x Nasi Goreng`, `1x Es Teh`).
     - **PENTING (Aturan EAI):** **JANGAN tampilkan harga rupiah sama sekali di layar dapur!** Dapur murni hanya melihat instruksi masak.
2. **Tombol Aksi Koki (Status Updater):**
   - Tombol **"Mulai Masak"** $\rightarrow$ Ubah status tiket jadi `COOKING`.
   - Tombol **"Selesai / Siap Saji"** $\rightarrow$ Ubah status tiket jadi `READY_FOR_PICKUP`.
   - Visual pembeda antar tiket yang baru masuk vs sedang dimasak.

---

## 🚫 Yang TIDAK Perlu Dibuat (Out of Scope):
Sesuai Project Charter, jangan buang waktu membuat komponen ini:
1. **Halaman Login / Register / Akun pengguna** (Sistem langsung terbuka di kasir & dapur).
2. **Metode Pembayaran / Payment Gateway / Kembalian** (Fokus EAI adalah aliran data antrean, bukan kasir keuangan).
3. **Manajemen Stok / Inventaris bahan baku**.

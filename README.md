# Food Ordering System (EAI Mini Project - Kelompok 5)

Proyek integrasi sistem pemesanan makanan (*Order Service*) dan antrean dapur (*Kitchen Service*) berbasis RESTful API dengan arsitektur **Point-to-Point (P2P)**.

---

## 👥 Pembagian Tugas Developer

| Anggota | Peran | Folder Tanggung Jawab | Port | Database |
|---|---|---|---|---|
| **Dev 1** | Order Service (Kasir) | `order-service/` | `3001` | `orders.db` |
| **Dev 2** | Kitchen Service (Dapur) | `kitchen-service/` | `3002` | `kitchen.db` |
| **Architect / Lead** | Integration & Contract | Root & `docs/` | - | - |

---

## 🚀 Cara Setup di Laptop Masing-Masing

### 1. Clone Repository
```bash
git clone https://github.com/intuezy/food-ordering.git
cd food-ordering
```

### 2. Install Dependencies
Jalankan perintah ini di root folder untuk menginstall dependencies kedua service sekaligus:
```bash
npm run install:all
```
*(Atau masuk ke masing-masing folder `order-service` dan `kitchen-service` lalu jalankan `npm install`)*

### 3. Menjalankan Service

Buka **2 tab terminal terpisah**:

- **Terminal 1 (Order Service):**
  ```bash
  npm run dev:order
  ```
  Service berjalan di: `http://localhost:3001`

- **Terminal 2 (Kitchen Service):**
  ```bash
  npm run dev:kitchen
  ```
  Service berjalan di: `http://localhost:3002`

---

## 🌿 Aturan Git Workflow (Biar Nggak Bentrok / Konflik)

1. **Buat branch baru sesuai tugas:**
   - Dev 1: `git checkout -b feat/order-service`
   - Dev 2: `git checkout -b feat/kitchen-service`
2. **Hanya ubah file di folder masing-masing:**
   - Dev 1 hanya fokus di folder `order-service/`.
   - Dev 2 hanya fokus di folder `kitchen-service/`.
3. **Commit dan Push ke branch sendiri:**
   ```bash
   git add .
   git commit -m "feat: implementasi fitur ..."
   git push origin <nama-branch-kamu>
   ```
4. **Buat Pull Request (PR)** ke `main` di GitHub.

---

## 📡 Alur Integrasi (Flow EAI)

```text
[Kasir / Klien]
      │
 (1) POST /api/orders (port 3001)
      ▼
[Order Service] ──── (2) Order Dispatch ────> [Kitchen Service]
(Simpan orders.db)                            (Simpan kitchen.db - tanpa harga)
      ▲                                              │
      │                                       (3) Koki update status
      └─────────── (4) PATCH callback ───────────────┘
                   (Status: COOKING -> READY_FOR_PICKUP)
```

1. **Order Dispatch:** Kasir membuat order. Order Service menyimpan order dan otomatis mengirim detail menu ke Kitchen Service via HTTP POST.
2. **Pemisahan Finansial:** Dapur **hanya** menerima nama menu & kuantitas, tanpa informasi harga.
3. **Status Callback:** Saat dapur mengubah status masak, Kitchen Service otomatis memanggil callback ke Order Service untuk mengupdate status kasir.

---

## 🧪 Testing API

1. **Menggunakan Postman:**
   Import file koleksi: [`docs/postman_collection.json`](docs/postman_collection.json) ke aplikasi Postman.
2. **Detail Kontrak API:**
   Baca spesifikasi lengkap endpoint dan JSON di [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

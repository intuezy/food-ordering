# API Contract & Integration Specification

> **Mata Kuliah:** Enterprise Architecture Integration (EAI)  
> **Topik:** Integrasi Sistem Pemesanan Makanan (Order Service) dan Manajemen Antrean Dapur (Kitchen Service)  
> **Arsitektur:** Point-to-Point (P2P) RESTful API  

---

## 1. Arsitektur & Pola Integrasi

```text
[Kasir / Frontend]
        │
   (1) POST /api/orders
        ▼
┌──────────────────────────────────────┐             (2) Order Dispatch (POST)             ┌──────────────────────────────────────┐
│            ORDER SERVICE             │ ────────────────────────────────────────────────> │           KITCHEN SERVICE            │
│          Port: 3001 (Node)           │ <──────────────────────────────────────────────── │          Port: 3002 (Node)           │
│           DB: orders.db              │          (3) Order Acceptance Reply (201)         │           DB: kitchen.db             │
└──────────────────────────────────────┘                                                   └──────────────────────────────────────┘
        ▲                                                                                                  │
        │                               (4) Status Callback Event (PATCH)                                  │
        └──────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        (e.g., COOKING -> READY_FOR_PICKUP)
```

### Prinsip Utama EAI:
1. **Database Terpisah (Dual Database):** `orders.db` dan `kitchen.db` tidak saling query langsung.
2. **Pemisahan Finansial vs Produksi:** Order Service mencatat harga (`price`, `total_price`). Kitchen Service **hanya** menerima instruksi masak (`item_name`, `quantity`), tanpa data finansial.
3. **Correlation Identifier:** Menggunakan `correlation_id` (bernilai sama dengan `order_id`) agar Kitchen Service dapat mereferensikan kembali order asal saat mengirim callback.
4. **Lifecycle Status:** `PENDING` → `IN_KITCHEN` → `COOKING` → `READY_FOR_PICKUP`.

---

## 2. Service A: Order Service (`:3001`)

- **Database:** `orders.db`
- **Tanggung Jawab:** Kasir membuat order, menyimpan transaksi lengkap + harga, mendispatch tiket ke Kitchen Service, dan menerima callback status dari dapur.

### Endpoints:

#### 2.1. `POST /api/orders`
Membuat pesanan baru oleh kasir dan otomatis dispatch ke Kitchen Service.

- **Request Body:**
  ```json
  {
    "customer_name": "Budi",
    "items": [
      { "item_name": "Nasi Goreng Spesial", "quantity": 2, "price": 25000 },
      { "item_name": "Es Teh Manis", "quantity": 2, "price": 5000 }
    ]
  }
  ```
- **Internal Action:**
  1. Hitung total harga (`60000`).
  2. Simpan order ke `orders.db` dengan status awal `PENDING`.
  3. Kirim HTTP POST ke Kitchen Service: `http://localhost:3002/api/kitchen/tickets` membawa `{ correlation_id, order_id, customer_name, items }` (tanpa harga).
  4. Begitu Kitchen Service membalas status `ACCEPTED`, ubah status order di `orders.db` jadi `IN_KITCHEN`.
- **Response (201 Created):**
  ```json
  {
    "order_id": 1,
    "customer_name": "Budi",
    "status": "IN_KITCHEN",
    "total_price": 60000,
    "kitchen_ticket_id": 1,
    "items": [
      { "item_name": "Nasi Goreng Spesial", "quantity": 2, "price": 25000 },
      { "item_name": "Es Teh Manis", "quantity": 2, "price": 5000 }
    ],
    "created_at": "2026-10-12T10:00:00.000Z"
  }
  ```

#### 2.2. `GET /api/orders`
Mengambil semua daftar pesanan beserta item-nya.

- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "customer_name": "Budi",
      "status": "COOKING",
      "total_price": 60000,
      "items": [ ... ],
      "created_at": "2026-10-12T10:00:00.000Z"
    }
  ]
  ```

#### 2.3. `GET /api/orders/:id`
Mengambil detail satu pesanan berdasarkan ID.

- **Response (200 OK):**
  ```json
  {
    "id": 1,
    "customer_name": "Budi",
    "status": "COOKING",
    "total_price": 60000,
    "items": [ ... ],
    "created_at": "2026-10-12T10:00:00.000Z"
  }
  ```

#### 2.4. `PATCH /api/orders/:id/status`
Endpoint callback yang dipanggil oleh Kitchen Service saat koki memperbarui status masak.

- **Request Body:**
  ```json
  {
    "status": "COOKING"
  }
  ```
  *(Status valid: `COOKING`, `READY_FOR_PICKUP`)*
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "order_id": 1,
    "new_status": "COOKING"
  }
  ```

---

## 3. Service B: Kitchen Service (`:3002`)

- **Database:** `kitchen.db`
- **Tanggung Jawab:** Menerima tiket pesanan dari Order Service, menampilkan antrean koki, mengupdate status pengerjaan, dan menembak callback ke Order Service.

### Endpoints:

#### 3.1. `POST /api/kitchen/tickets`
Diterima dari Order Service (Order Dispatch).

- **Request Body:**
  ```json
  {
    "correlation_id": 1,
    "order_id": 1,
    "customer_name": "Budi",
    "items": [
      { "item_name": "Nasi Goreng Spesial", "quantity": 2 },
      { "item_name": "Es Teh Manis", "quantity": 2 }
    ]
  }
  ```
- **Internal Action:**
  1. Simpan tiket ke `kitchen.db` dengan status `IN_KITCHEN`.
  2. Simpan item produksi ke `ticket_items`.
- **Response (201 Created):**
  ```json
  {
    "ticket_id": 1,
    "correlation_id": 1,
    "status": "ACCEPTED",
    "message": "Ticket successfully queued in kitchen"
  }
  ```

#### 3.2. `GET /api/kitchen/tickets`
Mengambil semua daftar tiket di antrean dapur.

- **Query Param (Opsional):** `?status=IN_KITCHEN` atau `?status=COOKING`
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "order_id": 1,
      "correlation_id": 1,
      "customer_name": "Budi",
      "status": "IN_KITCHEN",
      "items": [
        { "item_name": "Nasi Goreng Spesial", "quantity": 2 },
        { "item_name": "Es Teh Manis", "quantity": 2 }
      ],
      "created_at": "2026-10-12T10:00:00.000Z"
    }
  ]
  ```

#### 3.3. `PATCH /api/kitchen/tickets/:id/status`
Koki memperbarui status tiket dapur (misal mulai masak atau makanan selesai).

- **Request Body:**
  ```json
  {
    "status": "COOKING"
  }
  ```
  *(Status valid: `COOKING`, `READY_FOR_PICKUP`)*
- **Internal Action:**
  1. Update status tiket di `kitchen.db`.
  2. Tembak HTTP callback ke Order Service:
     `PATCH http://localhost:3001/api/orders/{ticket.order_id}/status`
     Payload: `{ "status": "COOKING" }`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "ticket_id": 1,
    "status": "COOKING",
    "callback_sent": true
  }
  ```

---

## 4. Pembagian Tugas Developer

| Peran | Penanggung Jawab | Direktori Kerja | Branch Git |
|---|---|---|---|
| **Order Service Lead** | Dev 1 | `order-service/` | `feat/order-service` |
| **Kitchen Service Lead** | Dev 2 | `kitchen-service/` | `feat/kitchen-service` |
| **Architect & Integration QA** | Anda | Root, `docs/`, Test Collection | `main` |

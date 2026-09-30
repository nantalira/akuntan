# qris-share-and-webhook Specification

## Purpose

Menyediakan sistem pencatatan pembayaran QRIS dan sumber dana (`payment_method`) secara hibrida yang ramah bagi pengguna awam melalui fitur PWA Native Web Share Target ("Bagikan ke Akuntan AI" tanpa setup) sekaligus mendukung pencatatan otomatis latar belakang melalui Personal Webhook (`POST /api/webhooks/qris/:token`) yang terisolasi per pengguna.

## Requirements

### Requirement: Payment Method Tracking on Transactions
Sistem SHALL menyimpan informasi metode pembayaran (`payment_method`, contoh: `Cash`, `QRIS`, `BCA`, `Mandiri`, `BRI`, `BNI`, `GoPay`, `OVO`, `DANA`, `ShopeePay`, `Transfer`) pada setiap transaksi baru serta menampilkannya sebagai badge pada daftar riwayat transaksi.

#### Scenario: Transaction recorded with wallet or bank keyword
- **WHEN** pengguna mencatat pengeluaran melalui Chat Drawer atau form dengan menyebut metode pembayaran (misal: `"Kopi 18rb pakai qris bca"`)
- **THEN** sistem menyimpan transaksi dengan nilai `payment_method` yang sesuai (`QRIS` / `BCA`) dan menampilkan badge metode pembayaran di `TransactionList`

### Requirement: Zero-Setup PWA Web Share Target for QRIS Receipts
Sistem SHALL mendaftarkan `share_target` pada manifest PWA (`manifest.webmanifest`) dan menyediakan endpoint penerima `/api/share-target` (atau query handler) sehingga pengguna yang meng-install PWA dapat membagikan (*Share*) gambar atau teks bukti transaksi langsung dari aplikasi mobile banking ke Akuntan AI tanpa konfigurasi teknis.

#### Scenario: User shares QRIS receipt image or text from banking app to Akuntan AI
- **WHEN** pengguna menekan tombol **"Bagikan / Share"** pada layar bukti pembayaran QRIS di aplikasi bank/e-wallet lalu memilih **Akuntan AI**
- **THEN** aplikasi membuka antarmuka pemrosesan bukti QRIS dengan gambar/teks yang dibagikan, mengekstrak nama merchant, nominal, kategori, serta `payment_method = 'QRIS'`, dan menyimpannya ke buku kas pengguna yang sedang login

### Requirement: Multi-User Personal QRIS Webhook Endpoint
Sistem SHALL menyediakan endpoint `POST /api/webhooks/qris/:token` yang memvalidasi `:token` terhadap kolom `users.webhook_token`, mengekstrak data transaksi menggunakan **Smart Dual-Engine Parser** (Regex Bank Indonesia + Fallback Gemini AI), mencegah duplikasi transaksi (`reference_id` atau kecocokan nominal+merchant dalam 3 menit terakhir), dan mencatat transaksi langsung ke `user_id` pemilik token.

#### Scenario: Valid QRIS notification payload received via personal webhook
- **WHEN** notifikasi push HP (MacroDroid) atau email forwarder mengirimkan payload JSON (`rawText` atau `{ merchant, amount }`) ke `POST /api/webhooks/qris/:token` dengan token yang valid
- **THEN** sistem mengidentifikasi `user_id` pemilik token, mengekstrak nama merchant, nominal, kategori, dan `payment_method = 'QRIS'`, serta menyimpan transaksi dengan `source = 'qris_webhook'`

#### Scenario: Duplicate webhook notification rejected idempotently
- **WHEN** webhook menerima kiriman ulang dengan `referenceId` yang sama atau merchant + nominal yang persis sama untuk `user_id` tersebut dalam kurun waktu 3 menit terakhir
- **THEN** sistem mengembalikan status `200 OK` dengan `duplicate: true` tanpa membuat baris transaksi ganda di database

### Requirement: One-Click Webhook Simulator and Pre-Configured Templates in Profile Modal
Antarmuka `ProfileModal` SHALL menyediakan tombol simulasi transaksi QRIS 1-klik serta tombol unduhan file template otomatisasi (`.macro` dan script Gmail) yang sudah otomatis berisi URL & Token Webhook milik pengguna yang sedang login.

#### Scenario: User triggers simulated QRIS webhook from Profile Modal
- **WHEN** pengguna menekan tombol **"⚡ Uji Simulasi Transaksi QRIS"** di dalam `ProfileModal`
- **THEN** sistem mengirim contoh notifikasi pembayaran QRIS ke endpoint webhook pengguna tersebut, menampilkan konfirmasi berhasil, dan transaksi QRIS baru langsung muncul di Dashboard pengguna

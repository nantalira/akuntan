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
Sistem SHALL mendaftarkan `share_target` pada manifest PWA (`manifest.webmanifest`) dengan method `POST` multipart/form-data dan menyediakan endpoint penerima `/api/share-target` sehingga pengguna yang meng-install PWA atau TWA dapat membagikan (*Share*) gambar atau teks bukti transaksi langsung dari aplikasi mobile banking ke Akuntan AI tanpa konfigurasi teknis.

#### Scenario: User shares QRIS receipt image or text from banking app to Akuntan AI
- **WHEN** pengguna menekan tombol **"Bagikan / Share"** pada layar bukti pembayaran QRIS di aplikasi bank/e-wallet lalu memilih **Akuntan AI**
- **THEN** aplikasi membuka antarmuka pemrosesan bukti QRIS dengan gambar/teks yang dibagikan, mengekstrak nama merchant, nominal, kategori, serta `payment_method = 'QRIS'`, dan menyimpannya ke buku kas pengguna yang sedang login

#### Scenario: Bypass Service Worker navigation fallback on share target POST
- **WHEN** peramban mengirim navigasi POST multipart/form-data ke `/api/share-target`
- **THEN** Service Worker tidak melakukan intercept (`navigateFallbackDenylist` mengecualikan `/^\/api\//`) dan Cloudflare Assets Worker (`run_worker_first: true`) meneruskan request langsung ke Worker backend tanpa menghasilkan HTTP 405 Method Not Allowed

#### Scenario: High-speed base64 encoding and dual-storage persistence
- **WHEN** Worker backend menerima file gambar bukti pembayaran QRIS
- **THEN** sistem mengonversi buffer gambar menggunakan binary Buffer base64 secara efisien (< 5ms) dan menyimpannya ke `localStorage` serta `sessionStorage` klien sebelum me-redirect ke antarmuka aplikasi utama

### Requirement: Multi-User Personal QRIS Webhook Endpoint
Sistem SHALL menyediakan endpoint `POST /api/webhooks/qris/:token` yang memvalidasi `:token` terhadap kolom `users.webhook_token`, mengekstrak data transaksi menggunakan **Smart Dual-Engine Parser** (Regex Bank Indonesia + Fallback Gemini AI), mencegah duplikasi transaksi (`reference_id` atau kecocokan nominal+merchant dalam 3 menit terakhir), dan mencatat transaksi langsung ke `user_id` pemilik token.

#### Scenario: Valid QRIS notification payload received via personal webhook
- **WHEN** notifikasi push HP (MacroDroid) atau email forwarder mengirimkan payload JSON (`rawText` atau `{ merchant, amount }`) ke `POST /api/webhooks/qris/:token` dengan token yang valid
- **THEN** sistem mengidentifikasi `user_id` pemilik token, mengekstrak nama merchant, nominal, kategori, dan `payment_method = 'QRIS'`, serta menyimpan transaksi dengan `source = 'qris_webhook'`

#### Scenario: Duplicate webhook notification rejected idempotently
- **WHEN** webhook menerima kiriman ulang dengan `referenceId` yang sama atau merchant + nominal yang persis sama untuk `user_id` tersebut dalam kurun waktu 3 menit terakhir
- **THEN** sistem mengembalikan status `200 OK` dengan `duplicate: true` tanpa membuat baris transaksi ganda di database

### Requirement: Streamlined QRIS Guide and Personal Webhook in Profile Modal
Antarmuka `ProfileModal` SHALL menyediakan alamat endpoint webhook unik dan token webhook personal pengguna, serta kartu panduan praktis "Bagikan Bukti Bayar QRIS (iOS & Android)" tanpa simulator interaktif atau unduhan file template MacroDroid/Apps Script yang usang.

#### Scenario: User accesses QRIS guide and webhook credentials in ProfileModal
- **WHEN** pengguna membuka modal Pengaturan Profil
- **THEN** sistem menampilkan webhook URL, token, tombol salin, dan panduan langkah penggunaan fitur Bagikan ke Akuntan AI via PWA Web Share Target

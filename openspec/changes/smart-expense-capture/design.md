## Context

Aplikasi Akuntan AI saat ini memiliki fondasi kokoh berbasis Cloudflare Workers (Hono), Cloudflare D1 SQLite, React SPA, dan Gemini 2.0 Flash parser. Desain teknis ini merinci implementasi 6 pilar fitur tambahan untuk melengkapi sistem menjadi asisten finansial yang lengkap, proaktif, dan minim friksi.

## Goals / Non-Goals

**Goals:**
1. Mengaktifkan manajemen target anggaran dan indikator visual health bar per kategori.
2. Mengintegrasikan Web Speech API browser (`id-ID`) ke dalam Chat Drawer tanpa dependensi eksternal.
3. Menyediakan komparasi cerdas pengeluaran (MoM - *Month-over-Month*) dan deteksi hari/transaksi terboros.
4. Menyediakan endpoint ekspor streaming CSV untuk unduhan laporan riwayat keuangan.
5. Menambahkan pelacakan metode pembayaran serta webhook `/api/webhooks/qris` untuk penangkapan data email bank.
6. Memanfaatkan Gemini 2.0 Flash Multimodal Vision pada endpoint `/api/scan-receipt` untuk ekstraksi foto struk belanja.

**Non-Goals:**
- Tidak membangun sistem perbankan terintegrasi (Open Banking API formal) karena membutuhkan lisensi institusi finansial; otomasi email/webhook sudah memadai untuk penggunaan personal.
- Tidak menambahkan database atau server tambahan; seluruh fitur tetap beroperasi 100% di dalam Cloudflare Workers & D1 Free Tier.

## Decisions

### 1. Pemanfaatan Tabel `budgets` yang Sudah Ada
- **Keputusan**: Menggunakan skema tabel `budgets` (`id`, `category`, `monthlyLimit`) yang sudah tersedia di D1.
- **Rasional**: Tidak memerlukan migrasi skema tabel baru untuk budgeting. Endpoint `/api/budgets` menyediakan operasi GET dan PUT untuk menyimpan batas limit per kategori.

### 2. Algoritma Smart Insights di Server
- **Keputusan**: Agregasi data komparasi MoM dihitung di endpoint `/api/analytics` atau `/api/analytics/insights`.
- **Rasional**: Query SQL D1 dapat membandingkan agregat tanggal 1 s/d hari ini pada bulan berjalan dengan tanggal 1 s/d tanggal yang sama di bulan lalu secara instan (<10ms).

### 3. Ekspor Data Streaming CSV Ringan
- **Keputusan**: Generate file CSV langsung dari memori Worker menggunakan standard text header `Content-Type: text/csv` dan `Content-Disposition: attachment`.
- **Rasional**: Menghindari library berat seperti `xlsx` atau `exceljs` di frontend/backend, menjaga ukuran bundle tetap sangat kecil.

### 4. Web Speech API di Frontend
- **Keputusan**: Menggunakan `window.webkitSpeechRecognition || window.SpeechRecognition` dengan konfigurasi bahasa `id-ID`.
- **Rasional**: Gratis, latensi 0ms ke server luar, dan memanfaatkan mesin speech Google di Android dan Siri di iOS.

### 5. Webhook QRIS Terproteksi Secret Token
- **Keputusan**: Endpoint `/api/webhooks/qris` memvalidasi header `X-Webhook-Secret`.
- **Rasional**: Memberikan fleksibilitas bagi Google Apps Script (Gmail watcher) atau Cloudflare Email Worker untuk meneruskan data struk dengan aman dan idempoten.

### 6. Multimodal Vision via Gemini 2.0 Flash
- **Keputusan**: Client mengompres gambar struk (maksimal 1024px) dan mengirimkan Base64 ke `/api/scan-receipt`.
- **Rasional**: Kompresi di sisi client menjaga payload HTTP tetap kecil (<300KB) dan mempercepat inferensi Gemini 2.0 Flash menjadi <1,5 detik.

## Risks / Trade-offs

- **[D1 Limit Query MoM Insights]** → *Mitigasi*: Menjalankan query paralel sederhana dengan indeks tanggal (`date`) agar jumlah baca D1 tetap sangat minim.
- **[Akurasi Pengenalan Struk Kasir Pudar]** → *Mitigasi*: Memberikan prompt terstruktur kepada Gemini dengan instruksi fokus pada baris `TOTAL` / `HARGA AKHIR`, serta menampilkan konfirmasi manual sebelum transaksi disimpan.
- **[Koneksi Internet Saat Input Suara]** → *Mitigasi*: Web Speech API browser memerlukan koneksi internet untuk recognizer Google/Apple. Jika offline, UI menampilkan notifikasi dan tombol keyboard tetap aktif.

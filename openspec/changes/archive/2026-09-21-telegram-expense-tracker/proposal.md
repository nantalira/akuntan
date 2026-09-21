## Why

Pencatatan pengeluaran manual di Google Sheets memiliki friksi tinggi, sementara antarmuka chat Telegram terbatas pada teks kaku tanpa visualisasi data interaktif. Dibutuhkan aplikasi personal finance modern multiplatform (Web & Mobile PWA) yang cepat, fleksibel, dan 100% gratis selamanya menggunakan stack modern Hono, SPA (React/Vite), Cloudflare D1 (SQLite di Edge), serta ditenagai Google Gemini 2.0 Flash untuk input bahasa alami, dashboard analitik real-time, dan manajemen utang-piutang.

## What Changes

- **Aplikasi Multiplatform (React + Vite PWA)**: Antarmuka Single Page Application (SPA) murni tanpa overhead SSR yang dapat di-install di HP (Android/iOS) sebagai aplikasi native tanpa URL bar, sekaligus tampil sebagai dashboard layar lebar di desktop.
- **Backend API Hono di Cloudflare Edge**: Framework Hono ultra-ringan (<14 kB) yang berjalan di Cloudflare Workers/Pages dengan end-to-end type safety via Hono RPC (`hono/client`).
- **Database Serverless di Edge (Cloudflare D1 + Drizzle ORM)**: Menggunakan SQLite terdistribusi di edge (server Jakarta, latensi <20ms) dengan kuota gratis 5 GB dan 5 juta pembacaan/hari.
- **In-App AI Chat Bar (Gemini 2.0 Flash)**: Fitur chat drawer mengambang di dalam aplikasi untuk input bahasa santai (*"bensin 30rb motor"*), deteksi rincian belanja, dan smart backdating.
- **Interactive Visual Dashboard**: Grafik donat 6 kategori (`Makan`, `Jajan`, `Primer`, `Motor`, `Olga`, `Belanja`), bar chart tren bulanan/tahunan, dan manajemen tabel transaksi (CRUD & search).
- **Papan Kartu Hutang & Split Bill**: Visualisasi saldo utang-piutang per orang dengan tombol pelunasan 1-klik dan kalkulasi patungan otomatis.
- **Skrip Migrasi Data Historis**: Mengimpor seluruh 23 tab data dari Google Sheet (Juli 2024 - September 2026) langsung ke Cloudflare D1.

## Capabilities

### New Capabilities
- `expense-tracking`: Parsing bahasa alami via in-app AI chat, klasifikasi 6 kategori, dan deteksi waktu lampau (backdating).
- `debt-settlement`: Papan kartu hutang-piutang interaktif, kalkulasi split bill otomatis, dan tombol pelunasan saldo.
- `sheet-management`: Manajemen data edge D1, dashboard visual analitik, dan migrasi data historis Google Sheets ke D1.

### Modified Capabilities

None.

## Impact

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (SPA / PWA).
- **Backend**: Hono API dengan Hono RPC di Cloudflare Workers/Pages.
- **Database**: Cloudflare D1 dikelola dengan Drizzle ORM.
- **AI Engine**: Google Gemini 2.0 Flash API (Free Tier via Google AI Studio).
- **Data Historis**: Migrasi 23 tab Google Sheets ke D1 sebagai seed data awal.

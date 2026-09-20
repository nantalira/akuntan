## 1. Project Scaffolding & Edge Database

- [x] 1.1 Inisialisasi struktur proyek fullstack Hono + React Vite SPA dengan Bun, TypeScript, dan Tailwind CSS, serta verifikasi build lokal (`bun run build`)
- [x] 1.2 Konfigurasi Cloudflare D1 database binding pada `wrangler.jsonc` dan setup Drizzle ORM schema (`transactions`, `debts`)
- [x] 1.3 Jalankan migrasi schema D1 lokal dengan `bun x wrangler d1 migrations apply DB --local` dan verifikasi tabel database berhasil dibuat

## 2. Hono API & Gemini AI Integration

- [x] 2.1 Implementasikan endpoint Hono CRUD transaksi (`/api/transactions`) dengan validasi dan Hono RPC type definitions
- [x] 2.2 Integrasikan Google Gemini 2.0 Flash API di endpoint `/api/chat` dengan *Structured JSON Output* untuk ekstraksi transaksi, split bill, dan backdating
- [x] 2.3 Implementasikan endpoint analitik (`/api/analytics`) untuk agregasi data donat kategori dan tren pengeluaran bulanan/tahunan
- [x] 2.4 Implementasikan endpoint manajemen hutang dan pelunasan (`/api/debts`) untuk update status kewajiban

## 3. Frontend SPA & PWA Development

- [x] 3.1 Bangun layout utama aplikasi SPA dengan sistem Passcode/PIN pengaman personal
- [x] 3.2 Bangun komponen Dashboard dengan kartu ringkasan, Donut Chart 6 kategori, dan Bar Chart tren pengeluaran
- [x] 3.3 Bangun komponen In-App Floating AI Chat Drawer yang terhubung ke Hono RPC `/api/chat`
- [x] 3.4 Bangun Papan Kartu Hutang-Piutang dengan tombol aksi pelunasan instan
- [x] 3.5 Bangun tabel riwayat transaksi dengan fitur pencarian, filter kategori, dan tombol aksi hapus/undo
- [x] 3.6 Konfigurasi PWA (`vite-plugin-pwa`) dengan manifest, tema warna, dan service worker untuk instalasi di layar utama HP

## 4. Data Migration & Deployment

- [x] 4.1 Buat skrip seeder migrasi (`scripts/migrate-sheets.ts`) dan jalankan via Bun (`bun scripts/migrate-sheets.ts`) untuk mengimpor seluruh data transaksi 23 tab Google Sheets ke Cloudflare D1
- [ ] 4.2 Jalankan deployment proyek ke Cloudflare Pages/Workers (`bun run build && bun x wrangler deploy`) dan konfigurasi secret `GEMINI_API_KEY`
- [ ] 4.3 Uji coba fungsionalitas end-to-end: input via chat drawer, verifikasi update dashboard seketika, dan instalasi PWA di perangkat HP

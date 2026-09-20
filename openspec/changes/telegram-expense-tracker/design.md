## Context

Sistem pencatatan pengeluaran pribadi ini dirancang sebagai aplikasi multiplatform modern (Web Desktop & Mobile PWA) yang cepat, fleksibel, dan 100% gratis selamanya. Menggantikan antarmuka chat Telegram yang kaku dan lembar Google Sheets yang rawan terdistorsi, sistem ini menggunakan framework Hono di Cloudflare Edge Workers, frontend React SPA (Vite), basis data serverless Cloudflare D1 (SQLite) dengan Drizzle ORM, serta Google Gemini 2.0 Flash API (Free Tier).

## Goals / Non-Goals

**Goals:**
- Mengembangkan frontend Single Page Application (SPA) berbasis React + Vite + Tailwind CSS + shadcn/ui dengan dukungan PWA (installable di Android/iOS).
- Mengembangkan backend API berkinerja tinggi menggunakan Hono dengan *end-to-end type safety* melalui Hono RPC (`hc<AppType>`).
- Menyediakan in-app AI chat drawer yang mengintegrasikan Gemini 2.0 Flash dengan *Structured JSON Output* untuk input bahasa bebas, ekstraksi multi-item belanja, dan backdating.
- Menyimpan data transaksi ke Cloudflare D1 (SQLite Edge) menggunakan Drizzle ORM.
- Menyediakan dashboard visual interaktif: donat chart 6 kategori (`Makan`, `Jajan`, `Primer`, `Motor`, `Olga`, `Belanja`), tren tahunan, dan kartu perhutangan dinamis.
- Mengimpor seluruh 23 tab data riwayat transaksi (Juli 2024 - September 2026) dari Google Sheets ke Cloudflare D1.
- Menjamin seluruh arsitektur berjalan 100% di atas tier gratis Cloudflare & Google AI Studio tanpa biaya server.

**Non-Goals:**
- Multi-user / multi-tenant SaaS (arsitektur dikhususkan untuk penggunaan personal pemilik).
- Penggunaan Server-Side Rendering (SSR) berat yang membebani komputasi edge dan tidak diperlukan untuk dashboard personal.
- Mengandalkan server database terpisah yang membutuhkan biaya bulanan (seperti AWS RDS atau Supabase berbayar).

## Decisions

### 1. Hono API + React SPA di Cloudflare Pages/Workers
- **Pilihan**: Hono API sebagai backend serverless dan React SPA (Vite) sebagai frontend, digabung dalam satu deployment Cloudflare.
- **Alasan**: Hono memiliki ukuran super ringan (<14 kB), latensi routing tercepat di dunia edge, dan fitur Hono RPC yang memberikan autocomplete tipe data penuh dari backend ke frontend tanpa setup GraphQL/tRPC.
- **Alternatif yang Dipertimbangkan**:
  - *Astro SSR*: Kurang alami untuk dashboard yang 100% interaktif dan tidak membutuhkan optimasi SEO.
  - *Next.js*: Bundle JavaScript terlalu berat untuk mobile PWA dan memakan kuota CPU runtime Cloudflare.

### 2. Cloudflare D1 + Drizzle ORM
- **Pilihan**: Cloudflare D1 (SQLite terdistribusi di edge) dikelola dengan Drizzle ORM.
- **Alasan**: Gratis 5 GB penyimpanan, 5.000.000 read/hari, dan 100.000 write/hari. Drizzle ORM memberikan skema type-safe dan migrasi otomatis yang sangat ringan.
- **Skema Tabel Database (`schema.ts`)**:
  ```typescript
  export const transactions = sqliteTable('transactions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    amount: integer('amount').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    time: text('time').notNull(), // HH:mm:ss
    category: text('category').notNull(), // Makan | Jajan | Primer | Motor | Olga | Belanja
    debtor: text('debtor'), // Kontak yang ditalangi (Terhutangi)
    creditor: text('creditor'), // Kontak yang menalangi (Menghutangi)
    debtAmount: integer('debt_amount').default(0),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  });

  export const debts = sqliteTable('debts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    contactName: text('contact_name').notNull().unique(),
    totalOwedToUs: integer('total_owed_to_us').default(0), // Piutang
    totalWeOwe: integer('total_we_owe').default(0),        // Hutang
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
  });
  ```

### 3. Google Gemini 2.0 Flash dengan Structured Output JSON
- **Pilihan**: Gemini 2.0 Flash API via Google AI Studio (`aistudio.google.com`).
- **Alasan**: Gratis 1.500 request/hari, waktu respons sangat cepat (<1 detik), dan akurasi tinggi dalam memahami konteks bahasa santai Indonesia (*"nalangi"*, *"patungan"*, *"kemarin malam"*).
- **Format JSON Response**:
  ```json
  {
    "action": "expense" | "settlement" | "split_bill",
    "name": "soto",
    "amount": 15000,
    "date": "2026-09-18",
    "time": "14:00:00",
    "category": "Makan",
    "debtor": "",
    "creditor": "",
    "debt_amount": 0,
    "notes": ""
  }
  ```

### 4. PWA (Progressive Web App) Client
- **Pilihan**: `@vite-pwa/vite-plugin-pwa`.
- **Alasan**: Memberikan kemampuan instalasi di HP (Android & iOS) dengan ikon khusus di layar utama (*home screen*), layar penuh (*standalone* tanpa address bar), dan caching offline aset statis.

### 5. Tooling & Package Manager: Bun v1.3+
- **Pilihan**: Bun sebagai package manager dan TypeScript runtime lokal.
- **Alasan**: Kecepatan instalasi dependensi 10x-30x lebih cepat dibanding npm, konsumsi disk lebih hemat, dan kemampuan mengeksekusi file TypeScript secara *native* (`bun scripts/migrate-sheets.ts`) tanpa perlu perkakas tambahan seperti `tsx` atau `ts-node`.

## Risks / Trade-offs

- **[D1 Limit Query Rows Read]** → Cloudflare D1 membatasi 5M row reads/hari pada Free Tier. *Mitigasi*: Tambahkan database index pada kolom `date` dan `category` agar query analitik tidak melakukan *full table scan*.
- **[Akses Pribadi / Keamanan]** → Karena aplikasi dihosting publik di Cloudflare Pages, data keuangan harus aman. *Mitigasi*: Implementasikan PIN otentikasi sederhana atau Passcode protection pada frontend SPA sebelum mengakses dashboard.

## Migration Plan

1. **Inisialisasi Proyek**: Setup template Cloudflare Workers + Vite (Hono + React + Tailwind) menggunakan Bun (`bun install`).
2. **Setup D1 Database**: Buat database D1 via `bun x wrangler d1 create akuntan-db` dan generate migrasi Drizzle ORM (`bun x drizzle-kit generate`).
3. **Migrasi Data Google Sheets**: Eksekusi skrip migrasi via Bun (`bun scripts/migrate-sheets.ts`) untuk membaca data riwayat 23 tab spreadsheet (Juli 2024 - September 2026) dan insert ke tabel `transactions` D1.
4. **Implementasi API & AI**: Buat route Hono untuk transaksi, analitik, dan chat drawer Gemini API.
5. **Implementasi UI SPA**: Bangun halaman dashboard, kartu hutang, floating chat, dan tabel riwayat.
6. **Deploy Cloudflare Pages**: Jalankan `bun run build` dan `bun x wrangler deploy`, serta set environment secret `GEMINI_API_KEY`.

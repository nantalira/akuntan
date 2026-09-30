## Context

Sistem Akuntan AI saat ini berjalan pada Hono di Cloudflare Workers, Cloudflare D1 (SQLite via Drizzle), dan antarmuka React (Vite PWA). Sistem autentikasi pengguna (`multi-user-auth`) sudah memiliki isolasi per tenant dan token webhook unik (`users.webhookToken`). Parser pembayaran (`paymentParser.ts`) sudah mampu mengekstrak notifikasi perbankan Indonesia secara instan via regex 0-kuota maupun cadangan Gemini AI. Berdasarkan keputusan terbaru, implementasi difokuskan pada:
1. Pembersihan tombol usang (MacroDroid `.macro` dan tombol salin skrip manual).
2. Penyediaan dua cara template Google mandiri (Google Sheet interaktif dan Editor Script langsung dengan automasi trigger).
3. Penundaan (pending) implementasi Jalur 1 Google OAuth 2.0 untuk fase berikutnya.

## Goals / Non-Goals

**Goals:**
- Menghapus tombol MacroDroid `.macro` dan tombol salin skrip manual dari `ProfileModal.tsx`.
- Menyediakan tautan template dokumen resmi Google Sheet (Cara 1: Google Sheet Interaktif) dengan petunjuk aktivasi tombol.
- Menyediakan tautan template salin proyek Apps Script langsung (Cara 2: Editor Script Langsung) dengan fungsi `setup()` otomatis.
- Menyediakan kemudahan penyalinan Webhook Token pengguna langsung dari modal profil.
- Mempertahankan fungsionalitas webhook endpoint `POST /api/webhooks/qris/:token` dan tombol uji simulasi transaksi QRIS.

**Non-Goals:**
- Mengimplementasikan alur Google OAuth 2.0 dan migrasi database tabel `users` pada fase ini (ditunda/pending).

## Decisions

### 1. Pembersihan Komponen Antarmuka `ProfileModal.tsx`
- Menghapus tombol lama:
  - `Download File .macro (HP)`
  - `Salin Script Gmail Otomatis`
- Menyusun ulang bagian automasi dengan struktur yang lebih bersih:
  - Bagian Informasi Endpoint & Token Webhook unik pengguna dengan tombol salin.
  - Tombol Uji Simulasi Transaksi QRIS untuk pengujian instan.
  - Kartu **Template Google Sinkronisasi Otomatis** dengan 2 pilihan akses:
    - **Cara 1 (Google Sheet Interaktif)**: Tombol *"📄 Buka Template Google Sheet (Salin 1-Klik)"* yang membuka template Google Sheet resmi dengan tombol interaktif aktivasi.
    - **Cara 2 (Editor Script Langsung)**: Tombol *"💻 Buka Editor Script Langsung (Salin Proyek)"* yang membuka link salin proyek Google Apps Script dengan fungsi `setup()` otomatis.

### 2. Penataan Template Google
- **Template Google Sheet Interaktif (Cara 1)**:
  - Tautan mengarah ke dokumen spreadsheet publik resmi dengan parameter `/copy`.
  - Spreadsheet memuat petunjuk pengisian token dan tombol gambar yang di-assign ke fungsi `setupTrigger()`.
- **Template Standalone Apps Script (Cara 2)**:
  - Tautan mengarah ke URL `https://script.google.com/d/{SCRIPT_ID}/edit?copy=true`.
  - Script memuat variabel token di baris atas serta fungsi `setup()` yang langsung memanggil `ScriptApp.newTrigger()`.

### 3. Penundaan (Pending) Jalur 1 Google OAuth
- Spesifikasi dan desain Google OAuth 2.0 tetap didokumentasikan, namun pengerjaan kodenya ditunda sesuai arahan pengguna agar pengujian difokuskan pada kedua cara template terlebih dahulu.

## Risks / Trade-offs

- **[Risk] Pengguna lupa menempelkan token ke dalam template Google** → **Mitigasi**: Sediakan tombol salin token yang jelas dan petunjuk ringkas 2 langkah langsung di antarmuka `ProfileModal.tsx`.

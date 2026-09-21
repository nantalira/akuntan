## Context

Aplikasi Akuntan AI menggunakan Google Gemini API (`gemini-3.5-flash-lite` / `gemini-3.8-flash`) untuk memproses input natural language chat dan scan struk belanjaan. Pada akun gratis (Free Tier), Google menerapkan kuota harian (RPD) sebanyak 500 request untuk seri Flash Lite dan 20 request untuk seri Flash biasa, serta 5-15 RPM. Google AI Studio tidak menyediakan header sisa kuota langsung di respons HTTP, sehingga aplikasi memerlukan pelacakan mandiri (*in-app telemetry*) di Cloudflare D1.

## Goals / Non-Goals

**Goals:**
- Melacak setiap panggilan sukses ke Gemini API secara real-time pada database Cloudflare D1.
- Menentukan batas limit harian secara cerdas berdasarkan nama model yang aktif (500 untuk Flash Lite, 20 untuk Flash biasa).
- Menyediakan endpoint `GET /api/ai-quota` untuk memeriksa sisa kuota kapan saja.
- Menampilkan badge indikator sisa kuota yang elegan dan informatif di header [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx).
- Menerapkan tombol debounce 1.5 detik pada UI untuk mencegah spam melebihi batas RPM.
- Memperbaiki parser darurat lokal agar tetap bersih jika kuota AI habis atau offline.

**Non-Goals:**
- Tidak membatasi penggunaan di luar AI (misalnya transaksi manual atau ekspor CSV tidak dibatasi).
- Tidak menggunakan WebSocket Live API untuk saat ini (tetap menggunakan model HTTP REST Flash Lite).

## Decisions

### 1. Tabel D1 `ai_usage` dengan Single Row Per Tanggal
- **Pilihan:** Membuat tabel `ai_usage` dengan kolom `date` (format `YYYY-MM-DD`, `UNIQUE`), `request_count`, `model_used`, dan `updated_at`.
- **Alasan:** Sangat ringan dan cepat. Penambahan kuota cukup menggunakan operasi SQLite *upsert*:
  `INSERT INTO ai_usage (date, request_count, model_used) VALUES (?, 1, ?) ON CONFLICT(date) DO UPDATE SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP`.
- **Alternatif dipertimbangkan:** Menghitung jumlah record di tabel `transactions` hari ini. Ditolak karena transaksi manual atau import CSV tidak menggunakan kuota Gemini, dan scan struk yang gagal tidak boleh salah hitung.

### 2. Penghitungan Limit Harian Otomatis
- **Pilihan:** Limit harian ditentukan dari `GEMINI_MODEL`:
  - Jika nama model mengandung `lite` (contoh: `gemini-3.5-flash-lite`): limit = 500.
  - Jika nama model lainnya (contoh: `gemini-3.8-flash` / `gemini-3.5-flash`): limit = 20.
  - Dapat di-override via env binding `AI_DAILY_LIMIT` jika pengguna memiliki tier berbayar (Pay-As-You-Go).
- **Alasan:** Pengguna tidak perlu repot menyetel angka batas kuota secara manual setiap kali mengganti model.

### 3. Letak Indikator di Header Chat Drawer
- **Pilihan:** Meletakkan badge kapsul kecil di header drawer di bawah nama "Akuntan AI".
- **Alasan:**
  - Terlihat seketika saat drawer dibuka tanpa memakan ruang input textarea di bawah.
  - Menggunakan 3 tingkat warna status:
    - 🟢 **Aman (> 20% sisa):** Hijau lembut `bg-emerald-50 text-emerald-700 border-emerald-200`
    - 🟡 **Peringatan (<= 20% sisa):** Oranye/kuning `bg-amber-50 text-amber-700 border-amber-200`
    - 🔴 **Habis (0 sisa):** Merah lembut `bg-rose-50 text-rose-700 border-rose-200`

### 4. Debounce RPM Cooldown di Klien
- **Pilihan:** Setelah pengguna menekan Kirim atau berbicara lewat Mic, tombol diberi state *cooldown* selama 1.5 detik dengan indikator visual.
- **Alasan:** Mencegah pengguna tidak sengaja menekan tombol berkali-kali (*rapid clicking*) yang dapat memicu error limit per menit (RPM).

## Risks / Trade-offs

- **[Perbedaan Zona Waktu Reset Kuota]** → Google mereset kuota harian pada pukul 00:00 UTC (07:00 WIB). Mitigasi: Tanggal D1 menggunakan tanggal acuan UTC atau WIB yang konsisten agar mendekati siklus reset Google.
- **[Request dari Perangkat Berbeda]** → Karena counter disimpan di Cloudflare D1 (bukan LocalStorage browser), sisa kuota akan selalu tersinkronisasi akurat meskipun pengguna membuka dari HP maupun laptop.

## Migration Plan

1. Jalankan migrasi Drizzle untuk membuat tabel `ai_usage` di D1 lokal dan remote.
2. Tambahkan rute baru `src/server/routes/aiQuota.ts` dan hubungkan ke `src/server/index.ts`.
3. Perbarui `chat.ts` dan `scanReceipt.ts` untuk memanggil fungsi helper `incrementAiUsage(db, model)`.
4. Perbarui antarmuka `ChatDrawer.tsx` untuk menampilkan badge kuota dan menerapkan debounce.

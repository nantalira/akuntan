## Why

Pengguna yang mencatat transaksi melalui chat drawer dan scan struk sering kali tidak mengetahui sisa kuota harian (RPD - Requests Per Day) model AI Google Gemini mereka. Ketika kuota harian habis atau mendekati batas, sistem tiba-tiba gagal atau beralih ke parser darurat tanpa indikator yang jelas. Diperlukan pelacak penggunaan kuota AI harian (*real-time counter*) yang ditampilkan langsung di antarmuka Chat Drawer dan perlindungan laju request per menit (RPM anti-spam debounce) agar pengguna mengetahui status ketersediaan AI secara transparan.

## What Changes

- Menambahkan tabel pelacakan kuota AI harian `ai_usage` pada database SQLite D1.
- Menambahkan middleware/service pencatat penggunaan kuota setiap kali endpoint `/api/chat` atau `/api/scan-receipt` berhasil memanggil Google Gemini API.
- Menyediakan endpoint API `/api/ai-quota` untuk memeriksa sisa kuota, limit harian, dan model aktif.
- Menampilkan badge indikator kuota AI yang elegan pada header Chat Drawer (`✨ AI: X/Y sisa`) lengkap dengan indikator warna status (Hijau = aman, Kuning = menipis, Merah = limit tercapai).
- Menambahkan proteksi jeda kirim (*debounce cooldown*) 1.5 detik pada tombol Kirim dan Mic untuk mencegah pelanggaran limit per menit (RPM).
- Memperbaiki parser darurat lokal (*fallback local regex*) agar membersihkan stop-words percakapan jika kuota AI habis.

## Capabilities

### New Capabilities
- `ai-quota-counter`: Pencatatan real-time kuota harian AI Gemini, penyajian status sisa kuota ke frontend, dan mekanisme proteksi rate limit pengguna.

### Modified Capabilities
<!-- Tidak ada perubahan requirement pada kapabilitas utama yang sudah ada -->

## Impact

- **Database**: Skema baru tabel `ai_usage` di Cloudflare D1.
- **Backend API**: Rute baru `/api/ai-quota` dan pembaruan pada `src/server/routes/chat.ts` dan `src/server/routes/scanReceipt.ts`.
- **Frontend SPA**: Penambahan query/state sisa kuota AI dan rendering badge status pada [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx).

## 1. Database & Tracking Service

- [x] 1.1 Tambahkan skema tabel `ai_usage` pada `src/db/schema.ts` dan jalankan `bun run db:generate` serta `bun run db:migrate:local`
- [x] 1.2 Buat modul utilitas `src/server/utils/aiUsage.ts` untuk mencatat penambahan kuota harian (+1) via SQLite upsert dan menghitung batas limit dinamis berdasarkan model aktif

## 2. Backend Integration & Endpoint Kuota

- [x] 2.1 Buat rute baru `src/server/routes/aiQuota.ts` (`GET /api/ai-quota`) yang mengembalikan `{ used, limit, remaining, model, status }` dan pasang di `src/server/index.ts`
- [x] 2.2 Integrasikan helper pencatat kuota di `src/server/routes/chat.ts` dan `src/server/routes/scanReceipt.ts` setelah Gemini API sukses merespons
- [x] 2.3 Perbarui `chat.ts` untuk memeriksa `res.ok` dari Google API dan bersihkan stop-words (`hari ini`, `saya`, `beli`, `rp`, dll.) pada `fallbackLocalParser`

## 3. Frontend UI & RPM Cooldown

- [x] 3.1 Buat hook klien `src/client/hooks/useAiQuota.ts` untuk memuat data kuota AI dan menyediakan fungsi *refresh* setelah transaksi selesai
- [x] 3.2 Tampilkan badge indikator kuota di header [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx) dengan 3 status warna (hijau = aman, kuning = menipis, merah = limit habis)
- [x] 3.3 Terapkan proteksi *cooldown debounce* selama 1.5 detik pada tombol Kirim dan Mic di [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx) guna mencegah pelanggaran batas RPM (Requests Per Minute)
- [x] 3.4 Lakukan pengujian end-to-end lokal: verifikasi pengiriman pesan chat suara/teks, pastikan counter berkurang secara real-time dan build `bun run build` sukses

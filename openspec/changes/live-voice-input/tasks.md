## 1. Perbaikan Hook Voice Recognition (Lifecycle & Live Streaming)

- [x] 1.1 Perbarui `src/client/hooks/useSpeechRecognition.ts` dengan pola *fresh instantiation* di setiap pemanggilan `startListening()`, dukungan deteksi `isSecureContext`, serta penanganan error peramban (`not-allowed`, `no-speech`, `network`).
- [x] 1.2 Implementasikan pemrosesan event `onresult` yang menggabungkan teks final dan interim secara mulus agar langsung mengalirkan kata-per-kata ke callback `onTranscriptChange` secara real-time.

## 2. Peningkatan Antarmuka ChatDrawer (Visual Pulsing & Feedback)

- [x] 2.1 Tambahkan efek animasi outline berkedip yang tegas (*pulsing ring* `ring-4 ring-rose-400 ring-offset-2 animate-pulse` dan radar halo ping) pada tombol mikrofon di [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx) saat status perekaman aktif.
- [x] 2.2 Tampilkan umpan balik error yang ramah di antarmuka [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx) jika mikrofon tidak diizinkan oleh peramban atau jika dibuka di luar konteks HTTPS/localhost.
- [x] 2.3 Verifikasi uji coba input suara secara langsung: tombol mic memunculkan outline berkedip saat merekam, ucapan suara langsung terketik secara *live* ke kolom input teks, dan pesan dapat dikirim ke AI tanpa kendala.

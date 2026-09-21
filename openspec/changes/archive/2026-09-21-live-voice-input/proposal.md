## Why

Fitur input suara pada ChatDrawer mengalami kegagalan perekaman (*silent failure*) karena siklus hidup objek `SpeechRecognition` yang terkunci serta ketiadaan pesan kesalahan saat izin mikrofon belum diberikan. Selain itu, pengguna membutuhkan indikator visual yang jelas berupa efek outline berkedip (*pulsing ring*) saat tombol mikrofon ditekan untuk menandakan rekaman aktif, serta parsing suara langsung ke teks secara *live/real-time* (kata per kata) saat pengguna sedang berbicara.

## What Changes

- **Perbaikan Siklus Perekaman Suara**: Memperbarui hook `useSpeechRecognition` agar membuat instans `SpeechRecognition` baru setiap kali tombol ditekan, serta menangani error `not-allowed`, `no-speech`, dan penghentian otomatis secara tangguh.
- **Indikator Visual Outline Berkedip**: Menambahkan animasi outline berkedip (*pulsing ring / glowing halo*) pada tombol mic saat status perekaman aktif, sehingga pengguna yakin audio sedang ditangkap.
- **Live Interim Transcript**: Memanfaatkan event `interimResults` agar teks langsung muncul kata-per-kata di kolom input teks secara real-time saat pengguna sedang berbicara, tanpa harus menunggu jeda hening selesai.
- **Feedback & Notifikasi Izin**: Menampilkan pesan peringatan yang ramah dan jelas di antarmuka jika browser memblokir izin mikrofon atau jika Web Speech API tidak didukung oleh peramban yang dipakai.

## Capabilities

### New Capabilities
- `live-voice-input`: Perekaman suara berbasis Web Speech API yang handal dengan efek visual outline berkedip aktif dan transkripsi teks live real-time (interim results).

### Modified Capabilities
<!-- Tidak ada perubahan requirement pada spec baseline yang ada -->

## Impact

- Frontend: `src/client/hooks/useSpeechRecognition.ts`, `src/client/components/ChatDrawer.tsx`.
- Dependensi: Tidak memerlukan package baru (memanfaatkan standar Web Speech API peramban modern).
- Keamanan: Memerlukan izin akses mikrofon di browser peramban (`navigator.mediaDevices` / `SpeechRecognition`).

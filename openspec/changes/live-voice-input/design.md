## Context

Lihat `proposal.md` untuk latar belakang masalah. Saat ini antarmuka chat memanfaatkan Web Speech API via hook `useSpeechRecognition.ts`. Namun siklus hidup objek instans tunggal di `useEffect` sering terkunci setelah satu kali pemanggilan, pesan kesalahan tidak dimunculkan ke pengguna, dan belum ada umpan balik visual animasi outline berkedip yang menegaskan bahwa audio sedang direkam.

## Goals / Non-Goals

**Goals:**
- Mengimplementasikan pola *fresh instantiation* setiap kali pengguna menekan tombol rekam suara agar tidak terjadi *deadlock/stale state*.
- Mengalirkan transkripsi kata-per-kata secara *live* (*interim transcript*) langsung ke kolom pesan chat saat pengguna berbicara.
- Menambahkan visual outline berkedip (*pulsing ring & ping halo*) pada tombol mic yang sangat jelas terlihat saat sesi rekam aktif.
- Menampilkan pesan notifikasi langsung di Chat Drawer bila mikrofon diblokir oleh peramban.

**Non-Goals:**
- Tidak mengubah integrasi backend atau beralih ke server-side audio recognition (fokus memaksimalkan Opsi A: Web Speech API peramban).

## Decisions

### Decision 1: Fresh Instantiation per Sesi Rekam
- **Pilihan**: Membuat objek `new SpeechRecognitionClass()` baru di dalam handler `startListening()`, bukan satu kali di mount `useEffect`.
- **Alasan**: Implementasi Web Speech API di Chromium dan WebKit (Safari) memiliki bug umum di mana instans yang sama menolak dipanggil `.start()` kembali setelah siklus `onend` atau `onerror` selesai.
- **Alternatif**: Mempertahankan ref tunggal (terbukti macet dan tidak dapat merekam ulang).

### Decision 2: Real-Time Live Streaming Interim Results
- **Pilihan**: Mengaktifkan `recognition.interimResults = true` dan `recognition.continuous = false`, lalu menghitung gabungan teks dari `event.results` pada setiap event `onresult` untuk langsung dimasukkan ke state `input` chat.
- **Alasan**: Memberikan efek ketikan instan selaras dengan kata-kata yang diucapkan pengguna, sehingga pengguna tahu suaranya langsung dipahami.

### Decision 3: Efek Visual Outline Berkedip (Pulsing Ring)
- **Pilihan**: Membungkus tombol mic dengan efek Tailwind:
  - Efek ring berdenyut: `ring-4 ring-rose-400 ring-offset-2 animate-pulse bg-rose-500 text-white`.
  - Efek radar ping di latar belakang: `<span className="absolute inset-0 rounded-xl bg-rose-400 animate-ping opacity-75 pointer-events-none" />`.
- **Alasan**: Memenuhi permintaan pengguna agar ada tanda visual yang tegas dan tidak membingungkan bahwa mikrofon sedang aktif mendengarkan.

### Decision 4: Deteksi Keamanan (Secure Context) & Notifikasi Error
- **Pilihan**: Menampilkan banner/toast kesalahan jika `event.error === 'not-allowed'` atau jika aplikasi dibuka pada konteks non-HTTPS (`!window.isSecureContext`).

## Risks / Trade-offs

- **[Peramban Tanpa Dukungan Web Speech API (misal: Firefox)]** → Sembunyikan tombol secara anggun (*graceful degradation*) dan berikan catatan teks alternatif.
- **[Koneksi Internet untuk Speech Engine Google/Apple]** → Web Speech API bawaan peramban membutuhkan koneksi internet untuk mengonversi suara ke teks bahasa Indonesia (`id-ID`). Jika offline, `onerror` akan menangkap `network` error dan menampilkannya ke pengguna.

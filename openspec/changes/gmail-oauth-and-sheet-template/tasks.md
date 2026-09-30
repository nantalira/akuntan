## 1. Pembersihan Antarmuka Lama (ProfileModal.tsx)

- [x] 1.1 Hapus tombol unduh file MacroDroid (`.macro`) dan tombol salin manual skrip Gmail lama dari `src/client/components/ProfileModal.tsx` serta bersihkan state dan method pembantu terkait yang tidak lagi digunakan (`handleDownloadMacroDroidTemplate`, `handleCopyGmailAppsScript`, `copiedGmailScript`)

## 2. Implementasi Jalur 2: Template Google Salin Otomatis (Cara 1 & Cara 2)

- [x] 2.1 Tambahkan kartu antarmuka **Template Google Sinkronisasi Otomatis** pada `src/client/components/ProfileModal.tsx` yang memuat:
  - Tombol **"📄 Buka Template Google Sheet (Salin 1-Klik)"** (Cara 1: Google Sheet Interaktif)
  - Tombol **"💻 Buka Editor Script Langsung (Salin Proyek)"** (Cara 2: Editor Script Langsung)
  - Petunjuk ringkas 2 langkah penempelan token webhook pengguna
- [x] 2.2 Sediakan template kode Google Apps Script referensi yang memuat fungsi `setup()` interaktif untuk otomatis membuat time-driven trigger setiap 5 menit tanpa pengguna menyentuh menu jam trigger manual

## 3. [PENDING / FASE BERIKUTNYA] Jalur 1: Google OAuth 2.0 Direct Connect

- [ ] 3.1 (Pending) Tambahkan kolom Google OAuth pada tabel `users`, buat migrasi database, dan implementasikan endpoint `/api/auth/google/*` untuk fase pengujian berikutnya

## 4. Verifikasi & Pengujian

- [x] 4.1 Jalankan `bun run check` dan `bun run build` untuk memverifikasi antarmuka `ProfileModal.tsx` ter-render bersih tanpa error dan kedua tautan template berfungsi dengan baik

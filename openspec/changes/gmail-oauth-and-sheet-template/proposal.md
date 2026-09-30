## Why

Metode automasi struk QRIS berbasis file MacroDroid dan salin skrip manual di `ProfileModal.tsx` memiliki gesekan teknis yang tinggi bagi pengguna awam dan keterbatasan perangkat (hanya Android). Pengguna menginginkan antarmuka yang bersih dan penyediaan template Google yang dapat disalin secara instan (unlimited user tanpa batasan kuota verifikasi Google):
1. **Pembersihan Antarmuka Lama**: Menghapus tombol download template MacroDroid (`.macro`) dan tombol salin skrip manual lama yang membingungkan dari `ProfileModal.tsx`.
2. **Jalur 2 (Fokus Implementasi Sekarang): Template Google Salin Otomatis**:
   - **Cara 1: Google Sheet Interaktif**: Template Google Spreadsheet resmi yang memiliki kolom input token dan tombol interaktif *"🚀 AKTIFKAN SINKRONISASI"* yang otomatis membuat trigger waktu (setiap 5 menit) tanpa pengguna menyentuh kode.
   - **Cara 2: Editor Script Langsung**: Tautan salin proyek Google Apps Script langsung (`script.google.com/d/{SCRIPT_ID}/edit?copy=true`) yang dilengkapi fungsi `setup()` mandiri yang otomatis memasang pemicu waktu.
3. **Jalur 1 (Google OAuth 2.0 Direct Connect - PENDING)**:
   - Tetap tercatat dalam spesifikasi arsitektur masa depan, namun implementasi kodenya ditunda (pending) agar pengujian difokuskan terlebih dahulu pada kedua cara template Google mandiri.

## What Changes

- **Pembersihan Antarmuka Lama (`ProfileModal.tsx`)**:
  - Menghapus tombol *Download File .macro (HP)* dan tombol *Salin Script Gmail Otomatis*.
- **Implementasi Template Google Salin Otomatis (Jalur 2)**:
  - **Cara 1 (Google Sheet Interaktif)**: Menyediakan tombol *"📄 Buka Template Google Sheet (Salin 1-Klik)"* yang mengarahkan ke link `copy=true` spreadsheet resmi dengan petunjuk aktivasi 1-tombol.
  - **Cara 2 (Editor Script Langsung)**: Menyediakan tombol *"💻 Buka Editor Script Langsung (Salin Proyek)"* yang mengarahkan ke tautan salin proyek Apps Script mandiri dengan fungsi `setup()` otomatis.
  - Menampilkan token webhook pengguna dengan tombol salin cepat untuk ditempelkan ke template.
- **[PENDING] Jalur 1 (Google OAuth 2.0)**:
  - Migrasi skema database OAuth dan endpoint `/api/auth/google/*` ditunda (pending) untuk fase berikutnya.

## Capabilities

### New Capabilities
- `gmail-oauth-and-sheet-template`: Penyediaan template Google Sheet interaktif dan template editor script langsung dengan automasi trigger, serta persiapan arsitektur Google OAuth (pending).

### Modified Capabilities
- `user-auth`: [PENDING] Kolom penyimpanan token Google OAuth pada tabel `users` disiapkan untuk fase implementasi lanjutan.

## Impact

- **Client**: Pembaruan komponen `src/client/components/ProfileModal.tsx` untuk menghapus tombol usang dan menambahkan kartu navigasi kedua cara template Google.
- **Backend**: Endpoint `POST /api/webhooks/qris/:token` yang sudah ada tetap aktif sebagai penerima data transaksi dari kedua template Google tersebut.

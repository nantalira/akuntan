## Purpose

Menyediakan integrasi penarikan bukti pembayaran otomatis dari email Gmail melalui dua cara template Google mandiri (Google Sheet interaktif dan Editor Script langsung dengan automasi trigger bawaan), serta mempersiapkan arsitektur Google OAuth 2.0 yang ditunda (pending).

## ADDED Requirements

### Requirement: Interactive Google Sheet Template Link (Cara 1)
Sistem SHALL menyediakan tautan salin dokumen Google Sheet resmi (`copy=true`) pada modal Profil yang memungkinkan pengguna menduplikasi spreadsheet interaktif ke Google Drive mereka sendiri, mengisi token webhook pada sel yang disediakan, dan mengaktifkan pemicu waktu (trigger 5 menit) melalui tombol menu interaktif tanpa membuka editor kode.

#### Scenario: User opens Google Sheet interactive template
- **WHEN** pengguna menekan tombol "Buka Template Google Sheet (Salin 1-Klik)" di modal Profil
- **THEN** sistem membuka tautan Google Sheet template copy link di tab baru browser pengguna

### Requirement: Standalone Google Apps Script Template Copy Link (Cara 2)
Sistem SHALL menyediakan tautan salin proyek Google Apps Script mandiri (`script.google.com/d/{SCRIPT_ID}/edit?copy=true`) pada modal Profil yang memungkinkan pengguna menduplikasi proyek script dengan fungsi `setup()` yang otomatis membuat trigger waktu 5-menitan saat dijalankan.

#### Scenario: User opens standalone Apps Script template
- **WHEN** pengguna menekan tombol "Buka Editor Script Langsung (Salin Proyek)" di modal Profil
- **THEN** sistem membuka tautan salin proyek Apps Script mandiri di tab baru browser pengguna

### Requirement: ProfileModal Interface Cleanup and Template Hub
Komponen `ProfileModal.tsx` SHALL membersihkan tombol unduh file MacroDroid (`.macro`) dan tombol salin skrip manual lama, serta menyajikan antarmuka terpadu yang menampilkan:
1. Alamat endpoint webhook unik pengguna beserta tombol salin.
2. Token webhook unik pengguna beserta tombol salin.
3. Tombol navigasi Cara 1 (Google Sheet Interaktif) dan Cara 2 (Editor Script Langsung).
4. Tombol simulasi transaksi QRIS untuk pengujian langsung.

#### Scenario: User views updated ProfileModal
- **WHEN** pengguna membuka modal Pengaturan Profil
- **THEN** antarmuka tidak lagi menampilkan tombol download MacroDroid maupun tombol salin skrip manual lama, melainkan menampilkan pilihan Cara 1 (Google Sheet Interaktif) dan Cara 2 (Editor Script Langsung)

### Requirement: Google OAuth 2.0 Direct Connect [PENDING]
Sistem SHALL mencatat spesifikasi alur Google OAuth 2.0 resmi (`GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/google/sync-now`, dan `POST /api/auth/google/disconnect`), yang implementasi kodenya ditunda (pending) untuk fase berikutnya.

#### Scenario: Google OAuth implementation status
- **WHEN** pengembang meninjau cakupan implementasi saat ini
- **THEN** alur Google OAuth ditandai sebagai fitur tertunda (pending) dan tidak memblokir rilis antarmuka template Google

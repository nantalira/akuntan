# user-auth Specification

## Purpose

Menyediakan sistem autentikasi pengguna berbasis Email/Username + Password dengan Web Crypto `PBKDF2` dan sesi JWT di Cloudflare Workers, mendukung registrasi terbuka, penyimpanan kunci API Gemini pribadi (BYOK), pembuatan token Webhook QRIS unik per pengguna, serta struktur tabel yang siap diekspansi ke Google OAuth 2.0.

## Requirements

### Requirement: Public User Registration
Sistem SHALL menyediakan endpoint dan antarmuka pendaftaran terbuka (`POST /api/auth/register`) tanpa memerlukan kode undangan (invite code), yang membuat akun baru dengan password ter-hash (`PBKDF2`) serta menghasilkan `webhook_token` acak yang unik secara kriptografis.

#### Scenario: Successful new user registration
- **WHEN** pengguna baru mengirimkan `name`, `email`, dan `password` (minimal 6 karakter) ke `POST /api/auth/register` dengan `email` yang belum terdaftar
- **THEN** sistem menyimpan pengguna baru ke tabel `users` dengan `password_hash` hasil PBKDF2, membuat `webhook_token` unik (`wh_...`), mengembalikan sesi JWT (`HttpOnly` cookie dan token JSON), serta otomatis meloginkan pengguna ke dashboard kosong miliknya

#### Scenario: Duplicate email registration rejected
- **WHEN** pengguna mendaftar menggunakan `email` yang sudah terdaftar di tabel `users`
- **THEN** sistem menolak pendaftaran dengan status HTTP `409 Conflict` dan pesan bahwa email sudah terdaftar

### Requirement: Email and Password Authentication with JWT Session
Sistem SHALL memverifikasi kredensial pengguna pada `POST /api/auth/login` menggunakan perbandingan hash `PBKDF2` yang aman terhadap timing attack, dan menerbitkan JWT yang ditandatangani dengan `JWT_SECRET` (atau fallback secret yang diturunkan secara deterministik di environment Workers).

#### Scenario: Valid login credentials
- **WHEN** pengguna mengirimkan `email` dan `password` yang cocok ke `POST /api/auth/login`
- **THEN** sistem mengembalikan status `200 OK`, menetapkan cookie `akuntan_session` (`HttpOnly`, `SameSite=Lax`), serta mengembalikan profil dasar pengguna (`id`, `name`, `email`, `hasCustomGeminiKey`, `webhookToken`)

#### Scenario: Invalid login credentials
- **WHEN** pengguna mengirimkan `email` yang tidak ditemukan atau `password` yang salah
- **THEN** sistem mengembalikan status `401 Unauthorized` dengan pesan error kredensial tidak valid

### Requirement: Protected API Middleware
Seluruh endpoint `/api/*` (kecuali `/api/health`, `/api/auth/login`, `/api/auth/register`, dan endpoint webhook eksternal `/api/webhooks/qris/:token`) SHALL dilindungi oleh middleware autentikasi Hono yang memvalidasi JWT dari Cookie atau header `Authorization: Bearer <token>`.

#### Scenario: Unauthenticated request to protected endpoint
- **WHEN** klien memanggil endpoint terproteksi seperti `GET /api/transactions` tanpa sesi JWT yang valid
- **THEN** server menolak request dengan status `401 Unauthorized` dan frontend menampilkan layar Login/Register

### Requirement: User Profile BYOK Gemini API Key and Personal Webhook Token
Sistem SHALL memungkinkan pengguna yang sudah login untuk memperbarui `gemini_api_key` pribadi mereka (BYOK) melalui `PUT /api/auth/profile` dan me-regenerate `webhook_token` pribadi mereka melalui `POST /api/auth/webhook-token/regenerate`.

#### Scenario: User saves personal Gemini API Key (BYOK)
- **WHEN** pengguna menyimpan `geminiApiKey` melalui modal Pengaturan Profil (`PUT /api/auth/profile`)
- **THEN** sistem menyimpan kunci tersebut pada kolom `users.gemini_api_key` milik pengguna dan seluruh request AI (`chat`, `scan-receipt`, evaluasi AI) dari pengguna tersebut menggunakan API key pribadinya tanpa terhalang batas kuota server bersama

#### Scenario: User regenerates personal QRIS webhook token
- **WHEN** pengguna menekan tombol Regenerate Webhook Token (`POST /api/auth/webhook-token/regenerate`)
- **THEN** sistem mengganti `users.webhook_token` milik pengguna dengan token acak baru sehingga URL webhook lama tidak lagi berlaku

### Requirement: Google OAuth Connection State Storage [PENDING]
Tabel `users` SHALL dirancang untuk menyimpan data otorisasi Google OAuth per-pengguna (`google_refresh_token`, `google_email`, `google_connected_at`, dan `google_sync_enabled`), dengan implementasi migrasi database ditunda (pending) bersamaan dengan implementasi Jalur 1 Google OAuth.

#### Scenario: Deferred Google OAuth columns migration
- **WHEN** pengembang menjalankan migrasi saat ini
- **THEN** perubahan tabel `users` untuk Google OAuth ditunda ke fase rilis OAuth berikutnya

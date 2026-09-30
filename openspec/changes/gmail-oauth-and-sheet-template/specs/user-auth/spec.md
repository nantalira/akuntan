## ADDED Requirements

### Requirement: Google OAuth Connection State Storage [PENDING]
Tabel `users` SHALL dirancang untuk menyimpan data otorisasi Google OAuth per-pengguna (`google_refresh_token`, `google_email`, `google_connected_at`, dan `google_sync_enabled`), dengan implementasi migrasi database ditunda (pending) bersamaan dengan implementasi Jalur 1 Google OAuth.

#### Scenario: Deferred Google OAuth columns migration
- **WHEN** pengembang menjalankan migrasi saat ini
- **THEN** perubahan tabel `users` untuk Google OAuth ditunda ke fase rilis OAuth berikutnya

# multi-tenancy Specification

## Purpose

Menjamin isolasi data keuangan multi-tenant berbasis `user_id` di seluruh tabel Cloudflare D1 (`transactions`, `debts`, `budgets`, dan `ai_usage`), membatasi kuota AI harian secara adil per pengguna, serta memastikan migrasi seluruh data historis yang sudah ada ke akun pemilik utama (`user_id = 1`) tanpa kehilangan data.

## Requirements

### Requirement: Strict Per-User Data Isolation Across All Tables
Sistem SHALL mengikat setiap baris pada tabel `transactions`, `debts`, `budgets`, dan `ai_usage` ke `user_id` milik pengguna yang sedang login, sehingga pengguna hanya dapat melihat, menambah, mengubah, atau menghapus data miliknya sendiri.

#### Scenario: User queries transactions, analytics, debts, or budgets
- **WHEN** Pengguna A (`user_id = 2`) meminta daftar transaksi (`GET /api/transactions`), analitik (`GET /api/analytics`), daftar hutang (`GET /api/debts`), atau rekomendasi item sering dibeli (`GET /api/transactions/frequent`)
- **THEN** sistem hanya mengembalikan dan mengagregasi data yang memiliki `user_id = 2` dan tidak pernah membocorkan data milik `user_id = 1`

#### Scenario: Independent contact names and budgets across different users
- **WHEN** Pengguna A (`user_id = 1`) dan Pengguna B (`user_id = 2`) sama-sama mencatat hutang dengan nama kontak `"Budi"` atau mengatur budget kategori `"Makan"`
- **THEN** database menyimpan kedua data tersebut secara terpisah menggunakan composite unique constraint `UNIQUE(user_id, contact_name)` pada `debts` dan `UNIQUE(user_id, category)` pada `budgets` tanpa konflik

### Requirement: Zero-Data-Loss Legacy Data Inheritance
Saat migrasi skema multi-user dijalankan pada database D1 yang sudah berisi data historis, sistem SHALL membuat atau menetapkan akun pemilik utama (`id = 1`) dan meng-assign seluruh baris lama pada `transactions`, `debts`, `budgets`, dan `ai_usage` ke `user_id = 1`.

#### Scenario: First account claims existing legacy records
- **WHEN** migrasi multi-user diterapkan dan pemilik utama login atau mendaftarkan akun pertama (`id = 1`)
- **THEN** seluruh transaksi, catatan hutang-piutang, dan budget historis yang sudah ada sebelumnya langsung tampil utuh di bawah akun `user_id = 1`

### Requirement: Per-User Daily AI Quota Tracking
Sistem SHALL melacak pemakaian Gemini AI pada tabel `ai_usage` berdasarkan kombinasi `(user_id, date)` sehingga pemakaian AI oleh satu pengguna tidak mengurangi jatah kuota harian pengguna lain.

#### Scenario: Shared server key daily limit enforced per user
- **WHEN** Pengguna B belum mengatur `gemini_api_key` pribadi (menggunakan API key server bersama) dan melakukan request AI
- **THEN** penghitung `ai_usage` diinkremen khusus untuk `(user_id = B, date = hari_ini)` dan hanya dibatasi oleh kuota harian per-user tanpa memengaruhi sisa kuota harian Pengguna A

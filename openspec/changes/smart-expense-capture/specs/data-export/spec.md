## Purpose

Memungkinkan pengguna mengunduh riwayat transaksi keuangan ke dalam format CSV agar dapat dibuka di Excel atau Google Sheets kapan saja.

## ADDED Requirements

### Requirement: CSV Export Generation
Sistem SHALL menyediakan endpoint GET `/api/export` yang menghasilkan file CSV berisi seluruh transaksi dengan header standar (`Tanggal, Jam, Nama, Nominal, Kategori, Metode, Pihak Terkait, Catatan`).

#### Scenario: User downloads monthly CSV
- **WHEN** pengguna menekan tombol "Ekspor CSV" dan memilih bulan tertentu atau semua riwayat
- **THEN** browser mengunduh file `.csv` dengan encoding UTF-8 dan format pemisah yang kompatibel dengan Microsoft Excel dan Google Sheets

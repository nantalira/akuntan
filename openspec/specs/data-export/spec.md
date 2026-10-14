# data-export Specification

## Purpose

Memungkinkan pengguna mengunduh riwayat transaksi keuangan ke dalam format CSV agar dapat dibuka di Excel atau Google Sheets kapan saja.

## Requirements

### Requirement: CSV Export Generation
Sistem SHALL menyediakan endpoint GET `/api/export` yang menghasilkan file CSV berisi seluruh transaksi dengan header standar (`Tanggal, Jam, Nama, Nominal, Kategori, Metode, Pihak Terkait, Catatan`).

#### Scenario: User downloads monthly CSV
- **WHEN** pengguna menekan tombol "Ekspor CSV" dan memilih bulan tertentu atau semua riwayat
- **THEN** browser mengunduh file `.csv` dengan encoding UTF-8 dan format pemisah yang kompatibel dengan Microsoft Excel dan Google Sheets

### Requirement: Streaming Edge Data Export
Sistem SHALL menyediakan pengunduhan berkas transaksi dalam format CSV dan JSON dengan header Content-Disposition yang tepat langsung dari edge worker.

#### Scenario: Export transactions to CSV
- **WHEN** pengguna menekan tombol Export CSV
- **THEN** sistem menghasilkan berkas CSV terstruktur dan memicu unduhan di browser


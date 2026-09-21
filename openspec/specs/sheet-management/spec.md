# sheet-management Specification

## Purpose
Mengelola penyimpanan data transaksi di Cloudflare D1, visualisasi analitik dashboard, operasi riwayat transaksi CRUD, serta migrasi data historis dari Google Sheets.

## Requirements

### Requirement: Interactive Dashboard Analytics
Sistem SHALL menyediakan dashboard analitik interaktif yang menampilkan visualisasi data pengeluaran dan status keuangan secara reaktif.

#### Scenario: Visualisasi grafik perbandingan kategori dan tren bulanan
- **WHEN** pengguna membuka halaman dashboard
- **THEN** sistem menampilkan donut chart perbandingan 6 kategori dan bar chart tren pengeluaran bulanan/tahunan yang terhitung otomatis dari Cloudflare D1

### Requirement: Transaction Data Management
Sistem MUST menyediakan antarmuka tabel transaksi lengkap dengan kemampuan pencarian, penyaringan (filter), dan pembatalan/penghapusan (undo).

#### Scenario: Pembatalan atau penghapusan transaksi
- **WHEN** pengguna memilih aksi hapus atau membatalkan transaksi yang baru saja dicatat
- **THEN** sistem menghapus baris transaksi dari tabel Cloudflare D1 dan memperbarui tampilan ringkasan dashboard seketika

### Requirement: Historical Google Sheets Migration
Sistem SHALL menyediakan kemampuan migrasi data satu-klik untuk mengimpor seluruh data historis dari 23 tab Google Sheets ke database Cloudflare D1.

#### Scenario: Import data 23 tab Google Sheets
- **WHEN** skrip migrasi data dijalankan dengan tautan Google Sheets
- **THEN** sistem mengonversi seluruh transaksi dari tab Juli 2024 hingga September 2026 ke dalam skema D1 dan mencatatnya tanpa kehilangan data

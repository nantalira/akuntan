# debt-settlement Specification

## Purpose
Mengelola pencatatan piutang (nalangi), hutang (ditalangi), pembagian tagihan patungan (split bill), serta pelunasan hutang antar kontak secara dinamis pada aplikasi.

## Requirements

### Requirement: Debt and Credit Recognition
Sistem SHALL mengenali transaksi yang melibatkan hutang atau piutang pihak ketiga berdasarkan kata kunci bahasa alami seperti "nalangi" dan "ditalangi".

#### Scenario: Menalangi pihak ketiga (Piutang / Terhutangi)
- **WHEN** pengguna memasukkan pesan "nalangi dian beli soto 15rb"
- **THEN** sistem mencatat pengeluaran soto 15000 dengan kolom debtor/terhutangi diisi "DIAN"

#### Scenario: Ditalangi pihak ketiga (Hutang / Menghutangi)
- **WHEN** pengguna memasukkan pesan "beli galon 11rb primer ditalangi dian"
- **THEN** sistem mencatat pengeluaran galon 11000 dengan kolom creditor/menghutangi diisi "DIAN" dan kolom debt_amount diisi 11000

### Requirement: Automated Split Bill Computation
Sistem MUST mampu menghitung pembagian pengeluaran bersama (*split bill*) dan mencatat porsi pengeluaran pengguna beserta sisa tanggungan pihak ketiga.

#### Scenario: Patungan bersama ditalangi pihak lain
- **WHEN** pengguna memasukkan pesan "beli token listrik 100rb patungan berdua sama dian, dian yang bayar"
- **THEN** sistem mencatat pengeluaran pribadi Rp 50.000 kategori Primer dan mencatat Menghutangi "DIAN" sebesar Rp 50.000

#### Scenario: Patungan bersama ditalangi pengguna
- **WHEN** pengguna memasukkan pesan "beli token listrik 100rb patungan berdua sama dian, aku yang bayar"
- **THEN** sistem mencatat pengeluaran pribadi Rp 50.000 kategori Primer dan mencatat Terhutangi "DIAN" sebesar Rp 50.000

### Requirement: Interactive Debt Settlement Recording
Sistem SHALL menyediakan antarmuka visual kartu hutang-piutang dengan kemampuan pelunasan per item transaksi mandiri maupun borongan untuk mengurangi saldo kewajiban tanpa menciptakan pencatatan kas ganda.

#### Scenario: Pelunasan hutang melalui tombol atau chat
- **WHEN** pengguna mengklik tombol "Lunasi" pada kartu kontak DIAN atau memasukkan pesan "bayar hutang dian 61rb"
- **THEN** sistem mencatat transaksi pelunasan yang mengurangi saldo hutang kepada "DIAN" sebesar Rp 61.000 sehingga saldo hutang bersih menjadi Rp 0

#### Scenario: Pelunasan hutang atau piutang per item transaksi dengan ikon centang
- **WHEN** pengguna menekan tombol ikon centang (`[ ✓ ]`) pada salah satu baris transaksi di rincian kontak atau modal daftar hutang
- **THEN** sistem menandai item transaksi tersebut sebagai lunas (`is_debt_settled = 1`) dan memotong saldo hutang/piutang kontak sebesar nominal transaksi tersebut di database

### Requirement: Contact Debt Item Drilldown and Reversal
Sistem SHALL memungkinkan setiap kartu kontak pada Halaman Hutang untuk diklik guna menampilkan Bottom Drawer berisi rincian item piutang dan hutang milik kontak tersebut, lengkap dengan pemisahan tab transaksi belum lunas dan riwayat selesai serta kemampuan pembatalan pelunasan (undo) menggunakan ikon kembalikan (`[ ↩ ]`).

#### Scenario: Menampilkan detail transaksi per kontak
- **WHEN** pengguna mengklik kartu kontak pada Halaman Hutang
- **THEN** sistem membuka Bottom Drawer yang menyajikan daftar transaksi piutang dan hutang yang terkait dengan kontak tersebut beserta saldo bersihnya

#### Scenario: Membatalkan pelunasan item transaksi (Undo)
- **WHEN** pengguna menekan tombol ikon kembalikan (`[ ↩ ]`) pada transaksi yang berada di tab Riwayat Selesai
- **THEN** sistem mengembalikan status item menjadi belum lunas (`is_debt_settled = 0`) dan mengembalikan saldo kewajiban kontak di tabel perhutangan

### Requirement: All-Time Dashboard Debt Drilldown Navigation
Sistem SHALL menjadikan kartu ringkasan "Piutang" dan "Hutang Kita" pada Dashboard dapat diklik untuk langsung menampilkan daftar seluruh item hutang atau piutang yang belum lunas (All-Time) dalam bentuk Bottom Drawer, dengan tata letak kartu yang adaptif terhadap judul dan nominal panjang agar tidak saling bertabrakan.

#### Scenario: Klik kartu Piutang pada Dashboard
- **WHEN** pengguna mengklik kartu "Piutang" pada Dashboard
- **THEN** sistem membuka Bottom Drawer berisi daftar seluruh item transaksi piutang dari semua kontak yang belum lunas

#### Scenario: Klik kartu Hutang pada Dashboard
- **WHEN** pengguna mengklik kartu "Hutang Kita" pada Dashboard
- **THEN** sistem membuka Bottom Drawer berisi daftar seluruh item transaksi hutang dari semua kontak yang belum lunas


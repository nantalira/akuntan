## Purpose

Mengelola pencatatan piutang (nalangi), hutang (ditalangi), pembagian tagihan patungan (split bill), serta pelunasan hutang antar kontak secara dinamis pada aplikasi.

## ADDED Requirements

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
Sistem SHALL menyediakan antarmuka visual kartu hutang-piutang dengan tombol aksi pelunasan instan untuk mengurangi atau mengenolkan saldo kewajiban.

#### Scenario: Pelunasan hutang melalui tombol atau chat
- **WHEN** pengguna mengklik tombol "Lunasi" pada kartu kontak DIAN atau memasukkan pesan "bayar hutang dian 61rb"
- **THEN** sistem mencatat transaksi pelunasan yang mengurangi saldo hutang kepada "DIAN" sebesar Rp 61.000 sehingga saldo hutang bersih menjadi Rp 0

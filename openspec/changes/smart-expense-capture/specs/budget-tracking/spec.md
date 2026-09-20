## Purpose

Menyediakan penetapan batas anggaran bulanan per kategori dan visualisasi health bar dinamis guna mencegah pemborosan sebelum akhir bulan.

## ADDED Requirements

### Requirement: Budget Limit Configuration
Sistem SHALL menyediakan antarmuka bagi pengguna untuk menentukan dan memperbarui batas anggaran maksimal bulanan untuk setiap kategori pengeluaran (`Makan`, `Jajan`, `Primer`, `Motor`, `Olga`, `Belanja`).

#### Scenario: User sets monthly budget
- **WHEN** pengguna memasukkan batas anggaran (misal: "Makan: Rp 1.500.000") dan menyimpannya
- **THEN** sistem menyimpan atau memperbarui nilai `monthlyLimit` di tabel `budgets` untuk kategori tersebut

### Requirement: Budget Health Bar Visualization
Sistem SHALL menampilkan progress bar persentase pemakaian anggaran per kategori di Dashboard dengan warna indikator status.

#### Scenario: Normal budget usage
- **WHEN** pengeluaran kategori di bawah 80% dari limit anggaran
- **THEN** bar ditampilkan dengan warna hijau dan persentase yang sesuai

#### Scenario: Warning budget usage
- **WHEN** pengeluaran kategori berada di antara 80% hingga 99% dari limit anggaran
- **THEN** bar ditampilkan dengan warna kuning/oranye sebagai tanda peringatan

#### Scenario: Overbudget usage
- **WHEN** pengeluaran kategori mencapai atau melebihi 100% dari limit anggaran
- **THEN** bar ditampilkan dengan warna merah dengan label "OVERBUDGET"

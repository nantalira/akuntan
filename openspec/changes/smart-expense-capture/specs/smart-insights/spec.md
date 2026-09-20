## Purpose

Menyajikan analisis ringkas dan komparasi kecenderungan pengeluaran secara otomatis untuk membantu pengguna memahami kebiasaan finansial mereka.

## ADDED Requirements

### Requirement: Month-over-Month Comparison
Sistem SHALL menghitung dan menampilkan persentase kenaikan atau penurunan pengeluaran bulan ini dibandingkan bulan sebelumnya pada tanggal yang setara.

#### Scenario: Spending is lower than last month
- **WHEN** total pengeluaran bulan ini lebih hemat dibandingkan periode yang sama bulan lalu
- **THEN** sistem menampilkan badge hijau dengan kalimat perbandingan (misal: "12% lebih hemat dari bulan lalu")

#### Scenario: Spending is higher than last month
- **WHEN** total pengeluaran bulan ini lebih boros dibandingkan periode yang sama bulan lalu
- **THEN** sistem menampilkan badge oranye/merah dengan peringatan perbandingan nominal

### Requirement: Top Spending and Spending Pattern Highlight
Sistem SHALL menyorot transaksi tunggal paling mahal di bulan berjalan dan hari dengan frekuensi pengeluaran tertinggi dalam seminggu.

#### Scenario: Display highest transaction and peak day
- **WHEN** pengguna membuka Dashboard
- **THEN** kartu Insight menampilkan nama dan nominal transaksi terbesar serta analisis hari terboros (misal: "Hari terboros rata-rata pada hari Sabtu")

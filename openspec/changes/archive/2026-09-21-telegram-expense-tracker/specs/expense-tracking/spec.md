## Purpose

Menyediakan kemampuan pencatatan pengeluaran harian berbasis in-app AI chat drawer pada aplikasi web/PWA dengan parsing bahasa alami, klasifikasi 6 kategori, dan deteksi waktu fleksibel.

## ADDED Requirements

### Requirement: Natural Language Expense Parsing
Sistem SHALL mengekstrak informasi pengeluaran dari teks percakapan bebas pengguna di antarmuka AI chat drawer aplikasi, mencakup nama transaksi, nilai harga, tanggal, jam, kategori, dan rincian belanja ke dalam format terstruktur.

#### Scenario: Transaksi tunggal bahasa santai
- **WHEN** pengguna memasukkan pesan "tadi makan soto 15k" di AI chat drawer
- **THEN** sistem mengekstrak nama "soto", harga 15000, kategori "Makan", dan mencatat tanggal serta jam transaksi saat ini

#### Scenario: Transaksi belanja dengan banyak rincian
- **WHEN** pengguna memasukkan pesan "superindo 35rb belanja sabun telur bumbu"
- **THEN** sistem mengekstrak nama "superindo", harga 35000, kategori "Belanja", dan mengisi kolom keterangan/notes dengan "sabun, telur, bumbu"

### Requirement: Categorization with Six Categories
Sistem MUST mengklasifikasikan setiap transaksi ke dalam salah satu dari 6 kategori valid: Makan, Jajan, Primer, Motor, Olga, atau Belanja.

#### Scenario: Deteksi kategori Belanja untuk barang non-makanan
- **WHEN** pengguna memasukkan pesan "beli celana jeans 120rb" atau "parfum 25rb"
- **THEN** sistem mengklasifikasikan transaksi tersebut ke kategori "Belanja" dan bukan "Jajan" atau "Primer"

#### Scenario: Deteksi kategori Olga untuk aktivitas olahraga
- **WHEN** pengguna memasukkan pesan "basket 20rb" atau "renang 15rb"
- **THEN** sistem mengklasifikasikan transaksi tersebut ke kategori "Olga"

### Requirement: Contextual Backdating
Sistem SHALL mendukung penentuan tanggal dan jam transaksi berdasarkan indikator waktu lampau dalam pesan pengguna.

#### Scenario: Pencatatan transaksi kemarin
- **WHEN** pengguna memasukkan pesan "kemarin malam bensin 30rb motor"
- **THEN** sistem menetapkan tanggal transaksi menjadi H-1 dari hari ini dengan perkiraan jam malam (sekitar 20:00)

#### Scenario: Default waktu saat ini jika tanpa keterangan waktu
- **WHEN** pengguna memasukkan pesan "kopi 10rb jajan" tanpa menyebutkan waktu
- **THEN** sistem menggunakan tanggal dan jam presisi saat transaksi dikirim

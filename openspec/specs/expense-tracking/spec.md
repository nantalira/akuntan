# expense-tracking Specification

## Purpose
Menyediakan kemampuan pencatatan pengeluaran harian berbasis in-app AI chat drawer pada aplikasi web/PWA dengan parsing bahasa alami, klasifikasi 6 kategori, dan deteksi waktu fleksibel.

## Requirements

### Requirement: Natural Language Expense Parsing
Sistem SHALL mengekstrak informasi pengeluaran dari teks percakapan bebas pengguna di antarmuka AI chat drawer aplikasi, mencakup nama transaksi, nilai harga, tanggal, jam, kategori, dan rincian belanja ke dalam format terstruktur.

#### Scenario: Transaksi tunggal bahasa santai
- **WHEN** pengguna memasukkan pesan "tadi makan soto 15k" di AI chat drawer
- **THEN** sistem mengekstrak nama "soto", harga 15000, kategori "Makan", dan mencatat tanggal serta jam transaksi saat ini

#### Scenario: Transaksi belanja dengan banyak rincian
- **WHEN** pengguna memasukkan pesan "superindo 35rb belanja sabun telur bumbu"
- **THEN** sistem mengekstrak nama "superindo", harga 35000, kategori "Belanja", dan mengisi kolom keterangan/notes dengan "sabun, telur, bumbu"

### Requirement: Categorization with Six Categories
Sistem MUST mengklasifikasikan setiap transaksi ke dalam salah satu dari kategori aktif milik pengguna yang terdaftar di sistem secara dinamis, baik melalui kecerdasan buatan Gemini maupun saat pengguna memilih kategori secara manual.

#### Scenario: Deteksi kategori Belanja untuk barang non-makanan
- **WHEN** pengguna memasukkan pesan "beli celana jeans 120rb" atau "parfum 25rb"
- **THEN** sistem mengklasifikasikan transaksi tersebut ke kategori yang sesuai dalam daftar kategori pengguna (seperti "Belanja")

#### Scenario: Deteksi kategori Olga untuk aktivitas olahraga
- **WHEN** pengguna memasukkan pesan "basket 20rb" atau "renang 15rb"
- **THEN** sistem mengklasifikasikan transaksi tersebut ke kategori yang relevan dalam daftar kategori aktif pengguna

### Requirement: Contextual Backdating
Sistem SHALL mendukung penentuan tanggal dan jam transaksi berdasarkan indikator waktu lampau dalam pesan pengguna.

#### Scenario: Pencatatan transaksi kemarin
- **WHEN** pengguna memasukkan pesan "kemarin malam bensin 30rb motor"
- **THEN** sistem menetapkan tanggal transaksi menjadi H-1 dari hari ini dengan perkiraan jam malam (sekitar 20:00)

#### Scenario: Default waktu saat ini jika tanpa keterangan waktu
- **WHEN** pengguna memasukkan pesan "kopi 10rb jajan" tanpa menyebutkan waktu
- **THEN** sistem menggunakan tanggal dan jam presisi saat transaksi dikirim

### Requirement: Transaction Editing via Bottom Drawer
Sistem SHALL menyediakan antarmuka penyuntingan transaksi lengkap berbasis Bottom Drawer yang dapat diakses melalui menu opsi transaksi pada riwayat transaksi. Antarmuka ini MUST mendukung pengubahan seluruh atribut transaksi mencakup nama, nominal, kategori, tanggal, jam, metode pembayaran, catatan tambahan, serta konfigurasi perhutangan.

#### Scenario: Membuka Drawer Edit Transaksi
- **WHEN** pengguna memilih opsi "Edit Transaksi" pada menu transaksi
- **THEN** sistem membuka Bottom Drawer dengan seluruh formulir terisi data awal transaksi yang dipilih

#### Scenario: Menyimpan Perubahan Transaksi
- **WHEN** pengguna memperbarui atribut transaksi dan menekan tombol "Simpan Perubahan"
- **THEN** sistem mengirim data pembaruan melalui permintaan HTTP PUT /api/transactions/:id, memperbarui catatan di database Cloudflare D1, menyegarkan data antarmuka, dan menutup Bottom Drawer

#### Scenario: Rekonsiliasi Perubahan Talangan ke Tabel Hutang
- **WHEN** pengguna mengubah status, kontak, atau nominal talangan pada transaksi yang diedit
- **THEN** sistem merekonsiliasi saldo agregat hutang-piutang kontak lama dan kontak baru secara diferensial di tabel perhutangan

### Requirement: Instant Transaction Inspection in AI Chat
Sistem SHALL menyediakan tombol aksi langsung "Lihat Transaksi" pada balon respon sukses pencatatan AI di Chat Drawer, sehingga pengguna dapat langsung meninjau rincian lengkap atau mengedit transaksi yang baru saja dicatat tanpa berpindah ke halaman riwayat.

#### Scenario: Menampilkan tombol Lihat Transaksi setelah pencatatan AI berhasil
- **WHEN** pengguna berhasil mencatat pengeluaran melalui pesan teks santai di AI Chat Drawer
- **THEN** sistem menyajikan tombol "Lihat Transaksi" di bagian bawah balon respon konfirmasi bot

#### Scenario: Membuka detail transaksi dari AI Chat Drawer
- **WHEN** pengguna menekan tombol "Lihat Transaksi" pada balon pesan AI
- **THEN** sistem langsung membuka Bottom Drawer Edit Transaksi dengan data transaksi terkait yang siap ditinjau atau diubah

### Requirement: Transaction History Presentation with Weekday and Actions Menu
Sistem SHALL menyajikan riwayat transaksi dengan format tanggal yang menyertakan nama hari berbahasa Indonesia (contoh: "Selasa, 6 Okt 2026") dan tombol menu titik tiga vertikal (`⋮`) untuk membuka popup aksi Edit dan Hapus secara efisien tanpa memenuhi tampilan baris transaksi.

#### Scenario: Menampilkan nama hari pada tanggal transaksi
- **WHEN** pengguna melihat daftar riwayat transaksi
- **THEN** sistem menampilkan tanggal setiap transaksi lengkap dengan nama hari berbahasa Indonesia (misal: "Selasa, 6 Okt 2026") beserta jam transaksi

#### Scenario: Membuka popup menu aksi transaksi
- **WHEN** pengguna mengklik tombol menu titik tiga (`⋮`) pada salah satu baris transaksi
- **THEN** sistem membuka popup ringkas yang menampilkan opsi "Edit Transaksi" dan "Hapus"

### Requirement: Infinite Scroll Pagination on Transaction History
Sistem SHALL menyediakan kemampuan pemuatan data transaksi berkelanjutan (*infinite scroll*) pada antarmuka riwayat transaksi untuk memuat batch transaksi berikutnya secara otomatis saat pengguna menggulir ke bagian akhir daftar, sehingga seluruh transaksi dalam periode yang difilter dapat diakses tanpa batasan pemotongan data awal.

#### Scenario: Pemuatan otomatis batch transaksi berikutnya
- **WHEN** pengguna menggulir antarmuka daftar transaksi hingga mencapai batas bawah tampilan dan masih terdapat transaksi lanjutan (`hasMore = true`)
- **THEN** sistem secara otomatis meminta batch data berikutnya dengan offset sesuai jumlah data yang telah termuat dan menyambungkannya ke daftar transaksi tanpa mereset posisi scroll

#### Scenario: Indikator saat memuat transaksi tambahan
- **WHEN** sistem sedang mengambil batch transaksi berikutnya dari server
- **THEN** sistem menampilkan animasi indikator pemuatan data (*loading spinner*) di bagian bawah daftar

#### Scenario: Seluruh data periode selesai dimuat
- **WHEN** seluruh transaksi dalam filter yang dipilih telah selesai dimuat (`hasMore = false`)
- **THEN** sistem menampilkan teks penutup yang mengonfirmasi bahwa seluruh transaksi telah ditampilkan dan menghentikan pengamatan scroll

#### Scenario: Reset pagination saat filter diubah
- **WHEN** pengguna mengubah filter bulan, tanggal, kategori, atau kata kunci pencarian
- **THEN** sistem mereset offset pagination kembali ke 0, mengosongkan daftar sebelumnya, dan memuat batch awal untuk filter baru tersebut



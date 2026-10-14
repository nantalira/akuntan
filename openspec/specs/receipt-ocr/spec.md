# receipt-ocr Specification

## Purpose

Mengekstrak informasi struk belanjaan fisik (foto/gambar) menjadi data pengeluaran terstruktur menggunakan Gemini 2.0 Flash Multimodal Vision API.

## Requirements

### Requirement: Receipt Image Upload and Camera Capture
Sistem SHALL menyediakan antarmuka bagi pengguna untuk mengambil foto struk via kamera HP atau mengunggah file gambar struk belanjaan (*JPEG/PNG/WebP*).

#### Scenario: User captures receipt image
- **WHEN** pengguna memilih opsi "Foto Struk" dan mengambil gambar struk kasir
- **THEN** sistem memuat pratinjau gambar dan menampilkan status pemrosesan ekstraksi

### Requirement: Multimodal Receipt Parsing
Sistem SHALL mengirimkan gambar struk ke endpoint backend `/api/scan-receipt` yang memanfaatkan Gemini 2.0 Flash Vision untuk mengekstrak nominal total, nama merchant, tanggal, kategori, dan daftar barang.

#### Scenario: Successful receipt extraction
- **WHEN** gambar struk kasir yang valid dikirim ke API
- **THEN** sistem mengembalikan objek terstruktur berisi `merchant`, `amount`, `category`, `date`, dan rincian `notes`

### Requirement: Confirmation Before Storing
Sistem SHALL menampilkan formulir konfirmasi hasil pembacaan struk kepada pengguna sebelum data dimasukkan ke database D1.

#### Scenario: User confirms extracted receipt
- **WHEN** data ekstraksi struk ditampilkan di layar dan pengguna menekan tombol "Simpan Transaksi"
- **THEN** transaksi berhasil dicatat ke database D1 dan grafik dashboard otomatis ter-update

### Requirement: Direct R2 Receipt Ingestion
Sistem SHALL menerima gambar struk belanja dan menyimpannya secara streaming langsung ke Cloudflare R2 bucket tanpa mem-buffer seluruh file di memori Workers di atas 128MB.

#### Scenario: Successful receipt vision extraction
- **WHEN** pengguna mengunggah foto struk belanja yang jelas
- **THEN** sistem menyimpan berkas di R2, mengirimkannya ke Gemini Flash Vision, dan mengembalikan data terstruktur

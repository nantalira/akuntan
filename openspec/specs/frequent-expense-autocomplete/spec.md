# frequent-expense-autocomplete Specification

## Purpose

Menyediakan layanan agregasi transaksi yang sering diinput dari riwayat database serta antarmuka Smart Hybrid Autocomplete pada Chat Drawer untuk input pengeluaran rutin secara cepat dan efisien.

## Requirements

### Requirement: Frequent Transactions Aggregation Endpoint
Sistem SHALL menyediakan endpoint `GET /api/transactions/frequent` yang mengembalikan daftar transaksi dengan frekuensi kemunculan tertinggi dari riwayat tabel transaksi di Cloudflare D1.

#### Scenario: Mengambil daftar transaksi terpopuler
- **WHEN** klien memanggil endpoint `GET /api/transactions/frequent` dengan parameter opsional `limit` (default: 15)
- **THEN** sistem mengembalikan daftar objek transaksi unik berisi nama (`name`), nominal terbaru/rata-rata (`amount`), kategori (`category`), dan jumlah frekuensi kemunculan (`frequency`) diurutkan dari frekuensi terbanyak

#### Scenario: Riwayat transaksi masih sedikit atau kosong
- **WHEN** pengguna baru menggunakan aplikasi dan riwayat transaksi di database masih kurang dari 3 item
- **THEN** sistem mengembalikan daftar item riwayat yang ada tanpa error, atau mengembalikan array kosong jika belum ada transaksi

### Requirement: Smart Hybrid Chips Interface in Chat Drawer
Antarmuka Chat Drawer SHALL menampilkan deretan tombol chip interaktif di atas input bar yang menyesuaikan statusnya secara adaptif berdasarkan teks yang sedang diketik oleh pengguna.

#### Scenario: Tampilan awal saat kolom input kosong
- **WHEN** pengguna membuka Chat Drawer dan kolom input teks dalam keadaan kosong
- **THEN** sistem menampilkan 4 hingga 6 chip transaksi yang paling sering diinput (misal: "Nasi Padang 18k", "Kopi 15k", "Bensin 30k") dengan ikon emoji kategori yang sesuai

#### Scenario: Penyaringan instan (auto-complete) saat pengguna mengetik
- **WHEN** pengguna mulai mengetik teks pada kolom input (misal: "nas")
- **THEN** deretan chip secara otomatis berganti menyaring dan hanya menampilkan item riwayat transaksi yang cocok (*case-insensitive*) dengan teks yang diketik

#### Scenario: Memilih item chip rekomendasi
- **WHEN** pengguna mengklik salah satu chip transaksi rekomendasi
- **THEN** teks pada kolom input otomatis terisi dengan format catatan transaksi lengkap (contoh: "Makan Nasi Padang 18000") dan kursor fokus siap dikirimkan atau diedit

#### Scenario: Menyembunyikan atau menampilkan baris saran
- **WHEN** pengguna menekan tombol toggle atau tombol tutup kecil `[×]` pada baris saran
- **THEN** baris chip saran disembunyikan untuk memberikan ruang tampilan riwayat chat yang lebih luas, dan status preferensi disimpan di sesi antarmuka

# category-management Specification

## Purpose

Mengelola definisi kategori pengeluaran kustom per pengguna dengan nama, ikon emoji, dan warna representatif, serta menyediakan akses konfigurasi melalui antarmuka Profil dan Modal Anggaran.

## Requirements

### Requirement: User Custom Category Definition with Emoji
Sistem SHALL memungkinkan setiap pengguna untuk membuat, membaca, memperbarui, dan menonaktifkan kategori pengeluaran mereka sendiri dengan atribut nama teks, simbol ikon emoji, dan kode warna visual.

#### Scenario: User creates a new custom category
- **WHEN** pengguna menambahkan kategori baru dengan nama "Kos", emoji "🏠", dan memilih warna
- **THEN** sistem menyimpan kategori baru tersebut ke database dengan relasi `userId` milik pengguna

#### Scenario: User edits an existing category
- **WHEN** pengguna mengubah nama atau emoji dari kategori yang sudah ada
- **THEN** sistem memperbarui data kategori tersebut tanpa merusak riwayat transaksi yang menggunakan kategori lama

#### Scenario: User deactivates or removes a category
- **WHEN** pengguna menghapus atau menonaktifkan suatu kategori
- **THEN** sistem menyembunyikan kategori tersebut dari opsi input transaksi baru namun tetap mempertahankan nama kategori pada riwayat transaksi masa lalu

### Requirement: Default Starter Categories Seeding
Sistem SHALL secara otomatis menyediakan kumpulan kategori awal (*starter template*) dengan emoji standar untuk pengguna baru saat pendaftaran serta bagi pengguna yang belum memiliki kategori kustom.

#### Scenario: New user onboarding seed
- **WHEN** pengguna baru mendaftar ke aplikasi
- **THEN** sistem otomatis menginisialisasi 6 kategori awal (Makan 🍜, Jajan ☕, Primer 🛒, Transport ⛽, Olga 🏸, Belanja 🛍️) ke dalam daftar kategori pengguna

### Requirement: Dual-Entry Category Management Interface
Sistem SHALL menyediakan antarmuka interaktif pengelolaan kategori yang dapat diakses dari menu Profil pengguna dan dari Modal Pengaturan Anggaran di Dashboard.

#### Scenario: Mengakses kelola kategori dari menu Profil
- **WHEN** pengguna membuka modal Profil dan memilih opsi Kelola Kategori
- **THEN** sistem menampilkan antarmuka daftar kategori dengan formulir penambahan nama dan pemilihan emoji

#### Scenario: Mengakses kelola kategori dari Modal Anggaran
- **WHEN** pengguna membuka Modal Atur Anggaran pada kartu Kesehatan Anggaran di Dashboard
- **THEN** sistem menyertakan tombol atau bagian untuk langsung menambah pos kategori baru sebelum menetapkan batas nominal anggaran

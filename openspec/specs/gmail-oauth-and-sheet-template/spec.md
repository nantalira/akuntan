# gmail-oauth-and-sheet-template Specification

## Purpose

Mendokumentasikan evolusi integrasi email bukti pembayaran QRIS: template Google Sheet dan Google Apps Script mandiri telah dipensiunkan (deprecated/retired) demi kemudahan PWA Web Share Target, sementara arsitektur resmi Google OAuth 2.0 direct connect tetap dipersiapkan untuk fase mendatang (pending).

## Requirements

### Requirement: Interactive Google Sheet Template Link (Cara 1) [RETIRED]
Sistem SHALL mendokumentasikan penarikan (retirement) metode Google Sheet interaktif mandiri dari antarmuka utama, karena kompleksitas multi-akun Google (`authuser=1`) dan friksi teknis tinggi yang telah digantikan oleh PWA Web Share Target.

#### Scenario: Retirement of Google Sheet template
- **WHEN** pengguna atau pengembang meninjau opsi integrasi bukti bayar di aplikasi
- **THEN** sistem tidak lagi menyajikan tombol atau dependensi template Google Sheet mandiri di antarmuka profil

### Requirement: Standalone Google Apps Script Template Copy Link (Cara 2) [RETIRED]
Sistem SHALL mendokumentasikan penarikan (retirement) metode Google Apps Script mandiri dari antarmuka utama, karena kendala izin otorisasi script Google yang telah digantikan oleh PWA Web Share Target.

#### Scenario: Retirement of standalone Apps Script template
- **WHEN** pengguna atau pengembang meninjau opsi integrasi bukti bayar di aplikasi
- **THEN** sistem tidak lagi menyajikan tombol atau dependensi template Apps Script mandiri di antarmuka profil

### Requirement: ProfileModal Interface Streamlining
Komponen `ProfileModal.tsx` SHALL membersihkan tombol template Google Sheet (Cara 1), Editor Script (Cara 2), simulator QRIS, dan MacroDroid lama, berfokus murni pada kredensial webhook personal dan panduan PWA Web Share Target.

#### Scenario: User views updated ProfileModal
- **WHEN** pengguna membuka modal Pengaturan Profil
- **THEN** antarmuka tidak menampilkan tombol template Google Sheet maupun Apps Script, melainkan menyajikan kredensial webhook dan panduan PWA Web Share Target yang ringkas

### Requirement: Google OAuth 2.0 Direct Connect [PENDING]
Sistem SHALL mencatat spesifikasi alur Google OAuth 2.0 resmi (`GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/google/sync-now`, dan `POST /api/auth/google/disconnect`), yang implementasi kodenya ditunda (pending) untuk fase berikutnya.

#### Scenario: Google OAuth implementation status
- **WHEN** pengembang meninjau cakupan integrasi email
- **THEN** alur Google OAuth ditandai sebagai fitur tertunda (pending) dan menjadi satu-satunya jalur integrasi email resmi yang direncanakan di masa depan

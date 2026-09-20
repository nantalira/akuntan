## Purpose

Melacak metode pembayaran (dompet/rekening) pada transaksi dan menerima notifikasi email struk QRIS otomatis via webhook.

## ADDED Requirements

### Requirement: Payment Method Selection
Sistem SHALL mendukung penandaan metode pembayaran (misal: `Cash`, `QRIS / Transfer`, `E-Wallet`) pada setiap transaksi baru.

#### Scenario: Transaction recorded with payment method
- **WHEN** transaksi dicatat via chat atau form dengan kata kunci dompet (misal: "bayar qris" atau "cash")
- **THEN** sistem menyimpan nilai metode pembayaran pada record transaksi

### Requirement: Secured Webhook Ingestion Endpoint
Sistem SHALL menyediakan endpoint POST `/api/webhooks/qris` yang dilindungi dengan header token `X-Webhook-Secret` untuk menerima data notifikasi email transaksi QRIS.

#### Scenario: Unauthorized webhook request
- **WHEN** request webhook dikirim tanpa header `X-Webhook-Secret` yang cocok
- **THEN** sistem mengembalikan respons HTTP 401 Unauthorized

### Requirement: Automatic Email Ingestion and Deduplication
Sistem SHALL memproses data struk QRIS yang masuk dan mencegah duplikasi pencatatan berdasarkan ID referensi bank.

#### Scenario: Valid new QRIS receipt received
- **WHEN** webhook menerima payload email struk QRIS baru yang valid
- **THEN** sistem mencatat pengeluaran ke database D1 dengan metode pembayaran `QRIS` dan nominal serta merchant yang sesuai

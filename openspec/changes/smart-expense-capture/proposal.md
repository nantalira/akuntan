## Why

Untuk menjadikan Akuntan AI sebagai asisten keuangan pribadi yang komprehensif, modern, dan minim friksi, diperlukan serangkaian fitur tambahan yang mencakup kemudahan input, otomatisasi data, kontrol pengeluaran, serta analitik cerdas. 

Proposal ini merangkum 6 fitur penyempurnaan utama:
1. **Sistem Budgeting & Health Bar**: Target anggaran per kategori dengan indikator visual dinamis (mencegah overspending).
2. **Input Suara (Voice-to-Text)**: Pencatatan cepat berbasis ucapan di Chat Drawer via Web Speech API (`id-ID`).
3. **Smart Insights & Komparasi Antar Bulan**: Rekap otomatis tren pengeluaran, perbandingan vs bulan lalu, dan hari terboros.
4. **Ekspor Data (CSV / Excel)**: Unduh data transaksi kapan saja untuk cadangan atau analisis spreadsheet.
5. **Pemisahan Sumber Dana & Webhook QRIS**: Pelacakan dompet/metode pembayaran serta auto-import struk QRIS dari email bank/e-wallet.
6. **Scan Struk Kasir (Multimodal OCR)**: Pembacaan struk belanjaan fisik secara instan menggunakan Gemini 2.0 Flash Vision.

## What Changes

- **Budgeting**: Pengaturan target anggaran bulanan per kategori di antarmuka, visualisasi health bar pada dashboard, dan peringatan dini saat mendekati/melebihi limit.
- **Voice Input**: Tombol mikrofon interaktif di Chat Drawer untuk mendikte pengeluaran dalam bahasa Indonesia tanpa mengetik.
- **Smart Insights**: Kartu ringkasan cerdas di dashboard yang menyajikan perbandingan persentase vs bulan lalu, pengeluaran terbesar, dan analisis kebiasaan pengeluaran.
- **Ekspor Data**: Endpoint dan tombol UI untuk mengunduh riwayat transaksi dalam format CSV/Excel.
- **Sumber Dana & QRIS Webhook**: Kolom metode pembayaran/dompet pada transaksi dan endpoint webhook `/api/webhooks/qris` untuk penangkapan transaksi otomatis dari email struk bank.
- **Scan Struk OCR**: Modal kamera/unggah struk dan endpoint `/api/scan-receipt` berbasis Gemini 2.0 Flash Vision untuk mengekstrak data struk kasir secara otomatis.

## Capabilities

### New Capabilities
- `budget-tracking`: Penetapan target anggaran bulanan per kategori dan indikator visual progress bar overbudget.
- `voice-input`: Input suara langsung di Chat Drawer menggunakan Web Speech API browser dalam Bahasa Indonesia.
- `smart-insights`: Analisis komparatif pengeluaran bulan ini vs bulan lalu serta ringkasan kebiasaan finansial.
- `data-export`: Ekspor riwayat transaksi ke format CSV dengan filter rentang waktu.
- `qris-and-wallets`: Pelacakan metode pembayaran dan ingestion webhook otomatis untuk notifikasi transaksi QRIS.
- `receipt-ocr`: Ekstraksi gambar/struk belanja kasir menjadi data pengeluaran terstruktur via Gemini 2.0 Flash Vision.

### Modified Capabilities
*(Tidak ada perubahan spesifikasi pada kapabilitas lama; fitur baru bersifat aditif terhadap alur yang sudah ada).*

## Impact

- **Database**:
  - Pemanfaatan tabel `budgets` yang sudah ada di skema Drizzle.
  - Penambahan kolom opsional `payment_method` pada tabel `transactions`.
- **Frontend**:
  - Penambahan tab/komponen Budgeting & Health Bar di Dashboard.
  - Komponen Voice Recognition di `ChatDrawer.tsx`.
  - Komponen Smart Insights Card di `Dashboard.tsx`.
  - Tombol Export CSV di `TransactionList.tsx`.
  - Komponen `ReceiptScannerModal.tsx` untuk foto/upload struk kasir.
- **Backend (Hono Routes)**:
  - Route baru `/api/budgets` (CRUD limit anggaran).
  - Route baru `/api/export` (generate CSV stream).
  - Route baru `/api/scan-receipt` (Gemini Vision multimodal).
  - Route baru `/api/webhooks/qris` (ingestion email struk).
- **Dependencies**:
  - 100% menggunakan native browser API & Gemini API yang sudah terpasang, tanpa library berbayar.

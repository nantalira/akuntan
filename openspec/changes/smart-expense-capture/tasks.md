## 1. Input Suara (Voice-to-Text) di Chat Drawer

- [x] 1.1 Buat hook `useSpeechRecognition` memanfaatkan Web Speech API browser (`id-ID`) dengan deteksi ketersediaan peramban
- [x] 1.2 Tambahkan tombol mikrofon interaktif di [ChatDrawer.tsx](file:///d:/Project/akuntan/src/client/components/ChatDrawer.tsx) dengan indikator animasi saat mendengarkan (*pulsing red/green*)
- [x] 1.3 Verifikasi ucapan suara ("Makan bakso 20 ribu") otomatis tertranskripsi ke input chat drawer dan dapat dikirimkan normal

## 2. Scan Struk Belanjaan (Multimodal OCR)

- [x] 2.1 Buat endpoint Hono `/api/scan-receipt` yang menerima gambar Base64 dan memprosesnya via Gemini 2.0 Flash Multimodal Vision
- [x] 2.2 Bangun komponen modal `ReceiptScannerModal.tsx` dengan akses kamera HP langsung (`capture="environment"`) atau pemilihan file galeri
- [x] 2.3 Buat antarmuka konfirmasi data hasil pembacaan struk (merchant, nominal, kategori, rincian) sebelum disimpan ke Cloudflare D1
- [x] 2.4 Verifikasi alur upload foto struk kasir: data terekstraksi akurat dan transaksi berhasil masuk ke database

## 3. Sistem Budgeting & Health Bar per Kategori

- [x] 3.1 Buat endpoint CRUD `/api/budgets` untuk membaca dan menyimpan target batas bulanan per kategori pada tabel `budgets`
- [x] 3.2 Bangun komponen `BudgetHealthCard.tsx` pada Dashboard dengan bar persentase pemakaian dan indikator warna dinamis (hijau <80%, kuning 80-99%, merah >=100% OVERBUDGET)
- [x] 3.3 Tambahkan modal dialog sederhana untuk mengatur nominal batas bulanan masing-masing dari 6 kategori
- [x] 3.4 Verifikasi budgeting: pengeluaran baru langsung menggeser progress bar dan memicu warna peringatan saat mendekati batas limit

## 4. Smart Insights & Komparasi Antar Bulan

- [ ] 4.1 Tambahkan logika analitik MoM (*Month-over-Month*) pada endpoint `/api/analytics` untuk membandingkan total pengeluaran bulan ini vs bulan lalu pada tanggal yang sama
- [ ] 4.2 Bangun kartu `SmartInsightsCard.tsx` di Dashboard yang menampilkan persentase hemat/boros, transaksi terbesar, dan hari dengan frekuensi belanja tertinggi
- [ ] 4.3 Verifikasi kartu insight: data komparasi dan transaksi terbesar tampil akurat berdasarkan data riwayat D1

## 5. Ekspor Data (CSV / Excel)

- [x] 5.1 Buat endpoint Hono `/api/export` yang mengalirkan data transaksi dalam format file CSV dengan header lengkap berbahasa Indonesia
- [x] 5.2 Tambahkan tombol "Ekspor CSV" pada antarmuka riwayat transaksi (`TransactionList.tsx`) dengan filter pilihan bulan berjalan atau seluruh histori
- [x] 5.3 Verifikasi unduhan file CSV: file berhasil diunduh dan dapat dibuka dengan rapi di Microsoft Excel atau Google Sheets

## 6. Pemisahan Sumber Dana & Ingestion Webhook QRIS

- [ ] 6.1 Tambahkan kolom opsional `payment_method` pada skema database dan perbarui parser chat untuk mengenali kata kunci dompet (Cash, QRIS, BCA, Gopay)
- [ ] 6.2 Buat endpoint webhook `/api/webhooks/qris` terproteksi token `X-Webhook-Secret` untuk menerima payload notifikasi email struk QRIS
- [ ] 6.3 Buat skrip pembantu Google Apps Script di `scripts/qris-email-sync.js` untuk integrasi otomatis Gmail -> Webhook Akuntan AI
- [ ] 6.4 Verifikasi ingestion webhook: simulasi request transaksi QRIS sukses tercatat otomatis di D1 tanpa duplikasi

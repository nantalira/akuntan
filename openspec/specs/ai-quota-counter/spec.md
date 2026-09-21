# ai-quota-counter Specification

## Purpose
Menyediakan sistem pelacakan kuota harian kecerdasan buatan (AI) Google Gemini secara real-time untuk mencatat pemakaian, menampilkan sisa kuota ke antarmuka pengguna, dan mencegah pelanggaran batas laju request.

## Requirements

### Requirement: Daily AI Quota Tracking
Sistem SHALL mencatat setiap pemanggilan sukses ke Google Gemini API (dari chat teks, input suara, maupun scan struk) ke dalam tabel pelacakan harian `ai_usage` di database D1.

#### Scenario: Increment usage on successful AI request
- **WHEN** endpoint `/api/chat` atau `/api/scan-receipt` berhasil menerima respon dari Gemini API
- **THEN** sistem menambahkan hitungan penggunaan harian (+1) untuk tanggal hari ini (WIB / UTC)

#### Scenario: Daily quota reset on new day
- **WHEN** tanggal sistem berganti ke hari berikutnya
- **THEN** sistem memulai hitungan penggunaan kuota dari 0 dengan batas harian model yang aktif

### Requirement: AI Quota Status Endpoint
Sistem SHALL menyediakan endpoint GET `/api/ai-quota` yang mengembalikan informasi pemakaian hari ini, batas limit harian, sisa kuota, dan nama model yang sedang aktif.

#### Scenario: User checks remaining quota
- **WHEN** klien memanggil GET `/api/ai-quota`
- **THEN** sistem mengembalikan objek JSON berisi `{ used: number, limit: number, remaining: number, model: string, status: "safe" | "warning" | "exceeded" }`

### Requirement: Visual Quota Indicator in Chat Drawer
Antarmuka Chat Drawer SHALL menampilkan badge indikator sisa kuota harian pada bagian header dengan pewarnaan status yang informatif.

#### Scenario: Normal remaining quota
- **WHEN** sisa kuota masih di atas 20% dari batas harian
- **THEN** badge menampilkan teks sisa kuota dengan warna hijau lembut (contoh: "✨ AI: 486 sisa")

#### Scenario: Quota approaching limit
- **WHEN** sisa kuota tersisa kurang dari 20% (atau kurang dari 10 request)
- **THEN** badge berubah menjadi warna kuning/oranye untuk mengingatkan pengguna bahwa kuota hampir habis

#### Scenario: Daily quota reached
- **WHEN** sisa kuota telah mencapai 0 (100% terpakai)
- **THEN** badge berubah warna merah ("⛔ Kuota AI Habis"), dan sistem secara transparan mengalihkan pemrosesan chat ke parser lokal yang sudah dibersihkan

### Requirement: Client-Side RPM Protection Debounce
Antarmuka pengguna SHALL menerapkan jeda pendinginan (*cooldown debounce*) pada tombol Kirim dan Mikrofon selama 1.5 detik setelah pengiriman pesan.

#### Scenario: Rapid repeated submission
- **WHEN** pengguna menekan tombol kirim atau mikrofon secara beruntun dalam waktu kurang dari 1.5 detik
- **THEN** sistem menonaktifkan tombol sementara dan mencegah request ganda agar tidak melanggar batas RPM (Requests Per Minute)

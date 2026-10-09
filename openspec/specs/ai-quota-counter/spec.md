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
Sistem SHALL menyediakan endpoint GET `/api/ai-quota` yang mengembalikan status pemakaian kuota harian. Bagi pengguna yang tidak mengonfigurasi API Key pribadi, pemakaian dihitung secara agregat dari seluruh pemanggil kunci server bawaan (*Shared Global Pool Quota*) terhadap batas kuota server, sedangkan pengguna dengan API Key pribadi menerima status kuota mandiri tanpa batas.

#### Scenario: User checks remaining quota
- **WHEN** pengguna tanpa custom key memanggil GET `/api/ai-quota`
- **THEN** sistem mengembalikan objek JSON berisi total pemakaian seluruh pengguna server hari ini, batas limit server (misal 500), sisa kuota bersama, status `safe | warning | exceeded`, dan flag `isCustomKey: false`

#### Scenario: User checks quota with custom Gemini API Key
- **WHEN** pengguna yang telah menyimpan custom Gemini API Key memanggil GET `/api/ai-quota`
- **THEN** sistem mengembalikan status kuota mandiri dengan limit 9999 dan flag `isCustomKey: true`

### Requirement: Visual Quota Indicator in Chat Drawer
Antarmuka Chat Drawer SHALL menampilkan badge indikator kuota bersama pada bagian header dengan label yang transparan dan informatif serta menyediakan penjelasan detail mengenai sifat berbagi kuota dan opsi penggunaan API Key pribadi.

#### Scenario: Normal remaining quota
- **WHEN** sisa kuota server bersama masih di atas 20% dari batas harian
- **THEN** badge menampilkan teks "✨ Kuota Bersama: {used}/{limit}" dengan warna hijau lembut dan tooltip yang menginformasikan bahwa kuota dibagi untuk seluruh pengguna aplikasi

#### Scenario: Quota approaching limit
- **WHEN** sisa kuota server bersama tersisa kurang dari 20% (atau kurang dari 10 request)
- **THEN** badge berubah warna menjadi kuning/oranye untuk mengingatkan seluruh pengguna bahwa kuota bersama hampir habis

#### Scenario: Daily quota reached
- **WHEN** sisa kuota server bersama telah mencapai batas maksimal (100% terpakai)
- **THEN** badge berubah warna merah ("⛔ Kuota Bersama Habis"), sistem mengalihkan chat ke parser lokal secara transparan, dan antarmuka mengarahkan pengguna untuk dapat memasukkan Gemini API Key pribadi di menu Profil

### Requirement: Client-Side RPM Protection Debounce
Antarmuka pengguna SHALL menerapkan jeda pendinginan (*cooldown debounce*) pada tombol Kirim dan Mikrofon selama 1.5 detik setelah pengiriman pesan.

#### Scenario: Rapid repeated submission
- **WHEN** pengguna menekan tombol kirim atau mikrofon secara beruntun dalam waktu kurang dari 1.5 detik
- **THEN** sistem menonaktifkan tombol sementara dan mencegah request ganda agar tidak melanggar batas RPM (Requests Per Minute)

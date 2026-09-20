## Purpose

Menyediakan fitur pengenalan suara (speech-to-text) bahasa Indonesia yang handal dengan indikator outline visual berkedip saat merekam dan penulisan teks langsung secara real-time saat pengguna berbicara.

## ADDED Requirements

### Requirement: Pulsing Outline Recording Indicator
Sistem SHALL menampilkan indikator visual yang jelas berupa efek outline berkedip (*pulsing ring / glowing halo*) di sekeliling tombol mikrofon selama sesi perekaman suara aktif.

#### Scenario: User activates recording
- **WHEN** pengguna menekan tombol mikrofon dan sesi perekaman audio aktif
- **THEN** tombol mikrofon menampilkan animasi outline berkedip terang (*pulsing ring*) dan ikon berubah menandakan sistem sedang mendengarkan

#### Scenario: User stops recording
- **WHEN** pengguna menekan kembali tombol mikrofon atau suara berhenti
- **THEN** animasi outline berkedip berhenti dan tombol kembali ke status normal

### Requirement: Live Streaming Interim Transcription
Sistem SHALL memperbarui kolom input teks secara *real-time* (kata per kata) memanfaatkan event `interimResults` saat pengguna sedang berbicara.

#### Scenario: Live speech typing
- **WHEN** pengguna mengucapkan kalimat belanjaan (contoh: "Makan soto 15 ribu")
- **THEN** kata-kata yang diucapkan langsung terketik secara progresif di kolom input chat secara *live*

### Requirement: Resilient Lifecycle and Permission Feedback
Sistem SHALL menginisialisasi instans `SpeechRecognition` baru pada setiap interaksi mulai rekam guna mencegah *stale state*, serta memberikan notifikasi visual jika izin mikrofon ditolak.

#### Scenario: Microphone permission denied
- **WHEN** peramban memblokir atau pengguna menolak izin mikrofon
- **THEN** sistem menghentikan status rekam dan menampilkan pesan peringatan ramah bahwa izin mikrofon diperlukan

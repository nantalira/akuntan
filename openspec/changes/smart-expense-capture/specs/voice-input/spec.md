## Purpose

Menyediakan kemampuan input pengeluaran berbasis ucapan suara langsung di antarmuka Chat Drawer menggunakan Web Speech API browser dalam Bahasa Indonesia.

## ADDED Requirements

### Requirement: Voice Recognition Activation
Sistem SHALL menyediakan tombol mikrofon interaktif di sebelah input chat untuk memulai dan menghentikan perekaman suara pengguna.

#### Scenario: User clicks microphone button
- **WHEN** pengguna menekan tombol mikrofon di Chat Drawer
- **THEN** sistem mengaktifkan *SpeechRecognition* browser dengan bahasa `id-ID` dan menampilkan indikator visual bahwa mikrofon sedang mendengarkan

### Requirement: Speech Transcription and Insertion
Sistem SHALL mengonversi ucapan suara pengguna menjadi teks tertulis dan menampilkannya di kolom input chat.

#### Scenario: Speech successfully converted
- **WHEN** pengguna selesai berbicara kalimat pengeluaran (misalnya "Makan bakso 20 ribu")
- **THEN** teks hasil pengenalan suara otomatis dimasukkan ke kolom input pesan chat drawer sehingga pengguna dapat meninjau atau langsung mengirimkannya

### Requirement: Voice Unsupported Fallback
Sistem SHALL memberikan notifikasi yang ramah jika browser pengguna tidak mendukung Web Speech API atau izin mikrofon ditolak.

#### Scenario: Browser does not support speech recognition
- **WHEN** pengguna membuka aplikasi di peramban yang tidak memiliki Web Speech API
- **THEN** tombol mikrofon disembunyikan atau dinonaktifkan dengan tooltip informatif

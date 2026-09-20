# Panduan Konfigurasi Firewall & Akses Jaringan Lokal (Akuntan AI)

Dokumen ini berisi kumpulan perintah untuk membuka akses dev server (`port 8787`) ke perangkat lain (seperti HP pada jaringan hotspot/Wi-Fi yang sama) secara **aman**, serta cara mengembalikannya ke kondisi semula (*revert*).

---

## 1. Membuka Akses Port 8787 (Aman - Khusus Private Network)

Jalankan perintah berikut di **PowerShell (Run as Administrator)**:

```powershell
# 1. Hapus aturan pemblokiran workerd bawaan Windows
netsh advfirewall firewall delete rule name="workerd"

# 2. Buka port 8787 HANYA untuk profil Private Network (Hotspot HP / Wi-Fi Rumah)
netsh advfirewall firewall add rule name="Akuntan Dev 8787" dir=in action=allow protocol=TCP localport=8787 profile=private
```

> **Catatan Keamanan**:  
> Dengan opsi `profile=private`, port 8787 **hanya terbuka** ketika laptop terhubung ke jaringan bertipe *Private*. Jika Anda berpindah ke Wi-Fi publik (kafe, bandara, hotel), Windows Firewall secara otomatis **langsung mengunci dan menutup port ini**.

---

## 2. Mengembalikan ke Kondisi Awal (Revert / Reset)

Jika proses testing di HP sudah selesai dan Anda ingin menghapus izin port ini:

```powershell
# Menghapus izin port 8787 (kembali ke kondisi awal)
netsh advfirewall firewall delete rule name="Akuntan Dev 8787"
```

*(Opsional) Jika ingin memasang kembali aturan pemblokiran eksplisit untuk `workerd` seperti awal:*
```powershell
netsh advfirewall firewall add rule name="workerd" dir=in action=block protocol=TCP profile=public
```

---

## 3. Perintah Diagnostik & Pengecekan

Jalankan perintah ini di PowerShell biasa (tanpa perlu administrator) untuk memeriksa kondisi jaringan:

### A. Cek Jenis Profil Jaringan Saat Ini (Public atau Private)
```powershell
Get-NetConnectionProfile
```
*Pastikan `NetworkCategory` bernilai **Private** saat testing via Hotspot HP.*

### B. Cek Apakah Port 8787 Sedang Aktif Mendengarkan
```powershell
Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
```

### C. Cek Aturan Firewall Port 8787
```powershell
netsh advfirewall firewall show rule name="Akuntan Dev 8787"
```

---

## 4. Alternatif: Tanpa Mengubah Firewall Sama Sekali (Cloudflare Tunnel)

Jika Anda berada di jaringan Wi-Fi umum / kafe atau tidak memiliki akses Administrator Windows, gunakan tunnel instan Cloudflare:

```bash
bun x cloudflared tunnel --url http://127.0.0.1:8787
```

* Cloudflare akan memberikan URL HTTPS publik (misal `https://xxx.trycloudflare.com`).
* Buka link tersebut di browser HP.
* **100% aman**: Tidak ada port di laptop yang dibuka ke jaringan luar.

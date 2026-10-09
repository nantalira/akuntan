import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Mic,
  PieChart,
  Share2,
  Smartphone,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

export type GuideTab = 'qris' | 'chat' | 'ocr' | 'debts' | 'categories' | 'byok';

interface FeatureGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: GuideTab;
  onTryPrompt?: (prompt: string) => void;
}

export const FeatureGuideModal: React.FC<FeatureGuideModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'qris',
  onTryPrompt
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>(initialTab);
  const [osTab, setOsTab] = useState<'android' | 'ios'>('android');

  if (!isOpen) return null;

  const handleQuickTry = (prompt: string) => {
    onClose();
    if (onTryPrompt) {
      onTryPrompt(prompt);
    } else {
      window.dispatchEvent(new CustomEvent('akuntan:open-chat', { detail: { prompt } }));
    }
  };

  const tabs: Array<{ id: GuideTab; label: string; icon: React.ReactNode }> = [
    { id: 'qris', label: 'PWA & QRIS Share', icon: <Share2 className="w-4 h-4" /> },
    { id: 'chat', label: 'AI Chat & Voice', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'ocr', label: 'Scan Struk OCR', icon: <Camera className="w-4 h-4" /> },
    { id: 'debts', label: 'Hutang & Piutang', icon: <Users className="w-4 h-4" /> },
    { id: 'categories', label: 'Kategori & Budget', icon: <PieChart className="w-4 h-4" /> },
    { id: 'byok', label: 'Gemini API Key', icon: <KeyRound className="w-4 h-4" /> }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                Panduan & Tutorial Fitur
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20 tracking-wide uppercase">
                  Akuntan AI
                </span>
              </h2>
              <p className="text-xs text-emerald-100">
                Kuasai cara otomatisasi pencatatan keuanganmu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Tutup panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-slate-50/70 overflow-x-auto flex gap-2 shrink-0 no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                  : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/70'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-sm">
          {/* TAB 1: PWA & QRIS Share Target */}
          {activeTab === 'qris' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Fitur Unggulan: Langsung Catat dari Layar m-Banking</span>
                </div>
                <p className="text-xs text-emerald-800/90 leading-relaxed">
                  Tidak perlu ketik manual setiap kali bayar kopi atau belanja! Cukup bagikan bukti
                  transfer / resi QRIS dari aplikasi m-banking ke Akuntan AI. AI Vision akan
                  otomatis membaca nama toko, nominal uang, waktu, dan metode pembayaran.
                </p>
              </div>

              {/* OS Switcher */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" /> Pilih Sistem Operasi HP:
                </span>
                <div className="inline-flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOsTab('android')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      osTab === 'android' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Android (Chrome)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsTab('ios')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      osTab === 'ios' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    iOS (iPhone Safari)
                  </button>
                </div>
              </div>

              {/* Step By Step Guide */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">
                      {osTab === 'android'
                        ? 'Pasang PWA ke Layar Utama (Android)'
                        : 'Simpan ke Layar Utama (iPhone Safari)'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {osTab === 'android'
                        ? 'Buka Akuntan AI di Google Chrome, ketuk menu titik tiga (⋮) di pojok kanan atas, lalu pilih "Tambahkan ke Layar Utama" atau "Instal Aplikasi".'
                        : 'Buka di Safari, ketuk tombol Share (ikon kotak panah ke atas) di menu bawah, lalu pilih "Add to Home Screen" (Tambah ke Layar Utama).'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Bayar Transaksi via QRIS</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Lakukan transaksi seperti biasa di aplikasi perbankan Anda (misal:{' '}
                      <strong>
                        myBCA, Livin Mandiri, BRImo, BNI Mobile, GoPay, OVO, atau DANA
                      </strong>
                      ).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">
                      Ketuk Tombol "Bagikan / Share"
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Pada struk transaksi sukses yang muncul di m-banking, klik tombol{' '}
                      <strong>Bagikan / Share</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Pilih Akuntan AI</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Pilih <strong>Akuntan AI</strong> dari menu pop-up Share sistem HP. Aplikasi
                      akan langsung membuka layar scanner cerdas dan mengekstrak rincian struk
                      otomatis!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI Chat & Voice */}
          {activeTab === 'chat' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Catat dengan Bahasa Alami</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Tidak perlu formulir yang rumit. Cukup ketik pengeluaranmu seperti sedang chatting
                  dengan teman, atau gunakan pesan suara AI.
                </p>
              </div>

              {/* Sample Prompts */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Coba Contoh Prompt (Klik
                  untuk mencoba langsung):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { text: 'Kopi kenangan 18rb bayar pake QRIS', tag: 'Kopi & QRIS' },
                    { text: 'Makan nasi padang rendang 24rb', tag: 'Makanan' },
                    { text: 'Beli bensin pertalite 35rb cash', tag: 'Transport' },
                    { text: 'Nalangi makan siang Budi 50rb', tag: 'Hutang / Talangan' }
                  ].map((sample) => (
                    <button
                      key={sample.text}
                      type="button"
                      onClick={() => handleQuickTry(sample.text)}
                      className="p-3 text-left rounded-xl bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 transition-all group flex flex-col justify-between"
                    >
                      <span className="text-xs font-semibold text-slate-800 group-hover:text-emerald-900 leading-snug">
                        "{sample.text}"
                      </span>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {sample.tag}
                        </span>
                        <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 flex items-center gap-0.5 font-bold">
                          Coba <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Input Highlight */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800">
                    Input Suara Langsung (Voice-to-Text)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Tekan ikon mic di samping kolom chat AI. Ucapkan kalimat belanja Anda secara
                    natural, dan AI akan otomatis mentranskripsi serta mengekstrak nominal,
                    kategori, dan metode pembayaran.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Scan Struk OCR */}
          {activeTab === 'ocr' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>OCR Struk Belanja Supermarket & Restoran</span>
                </div>
                <p className="text-xs text-blue-800/90 leading-relaxed">
                  Punya struk fisik dari minimarket (Indomaret, Alfamart) atau nota restoran? Foto
                  langsung struk tersebut untuk mencatat total belanja secara otomatis tanpa repot
                  mengetik satu per satu.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Buka Ikon Kamera</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Ketuk ikon kamera di pojok kiri bawah kolom Chat AI atau pada bilah aksi.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Foto atau Unggah Gambar</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Pastikan struk berada di tempat terang dan seluruh nominal total terlihat
                      jelas.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Konfirmasi Hasil Ekstraksi</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      AI Vision akan membaca nominal total, tanggal, dan nama toko. Anda dapat
                      mengoreksi data sebelum menyimpannya ke buku kas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Hutang & Piutang */}
          {activeTab === 'debts' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="font-bold text-sm text-slate-800">Catat Talangan & Hutang Teman</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Sering makan bareng teman dan talang-menalangi? Akuntan AI otomatis memisahkan
                  pengeluaran pribadi dan piutang yang harus dikembalikan teman.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-200 text-emerald-800">
                    Piutang (Teman Pinjam Uang Kita)
                  </span>
                  <h4 className="text-xs font-bold text-slate-800">Contoh Pencatatan:</h4>
                  <p className="text-xs text-slate-600 italic">
                    "Nalangi tiket bioskop Dimas 50rb"
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-1">
                    Dimas akan tercatat di daftar Piutang dengan saldo Rp 50.000 belum kembali.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/70 space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-200 text-rose-800">
                    Hutang (Kita Pinjam Uang Teman)
                  </span>
                  <h4 className="text-xs font-bold text-slate-800">Contoh Pencatatan:</h4>
                  <p className="text-xs text-slate-600 italic">
                    "Pinjam uang ke Reza 100rb buat bensin"
                  </p>
                  <p className="text-[11px] text-rose-800 mt-1">
                    Reza akan tercatat di daftar Hutang dengan status harus kita bayar kembali.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1.5">
                <h4 className="font-bold text-xs text-slate-800">Pelunasan Mudah</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Buka tab <strong>Hutang</strong> di navigation bar atas, ketuk nama orang yang
                  bersangkutan, dan klik tombol <strong>"Tandai Lunas"</strong> saat uang sudah
                  dikembalikan. Saldo akan otomatis ter-update!
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: Kategori & Budget */}
          {activeTab === 'categories' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="font-bold text-sm text-slate-800">
                  Personalisasi Kategori & Limit Anggaran
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Sesuaikan pos pengeluaran sesuai gaya hidupmu (misal: Kopi, Hobi, Sedekah,
                  Investasi) dan atur batas limit bulanan.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-base shrink-0">
                    🏷️
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Kelola Kategori Custom</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Buka menu Profil Anda di pojok kanan atas, lalu klik{' '}
                      <strong>"Kelola Kategori"</strong>. Anda dapat menambah hingga 8 kategori
                      baru, memilih ikon emoji, dan menentukan warna kartu.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-base shrink-0">
                    🎯
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Pantau Kesehatan Budget</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Di halaman Dashboard, kartu <strong>Budget Health</strong> akan menampilkan
                      persentase terpakai dengan indikator warna (Hijau aman, Kuning waspada, Merah
                      melebihi batas).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Gemini BYOK */}
          {activeTab === 'byok' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/70 space-y-2">
                <div className="flex items-center gap-2 text-purple-900 font-extrabold text-sm">
                  <KeyRound className="w-4 h-4 text-purple-600" />
                  <span>Bring Your Own Key (BYOK) - Gratis & Bebas Batas</span>
                </div>
                <p className="text-xs text-purple-800/90 leading-relaxed">
                  Secara bawaan akun Anda mendapatkan kuota AI harian gratis dari server. Jika Anda
                  ingin pemrosesan yang lebih leluasa dan tanpa batas harian, Anda dapat menggunakan
                  Gemini API Key milik Anda sendiri secara gratis dari Google.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Dapatkan API Key Gratis</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Buka <strong>Google AI Studio</strong> (aistudio.google.com), login dengan
                      akun Google Anda, dan klik tombol <strong>"Get API Key"</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Masukkan ke Menu Profil</h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Ketuk foto profil Anda di pojok kanan atas, tempelkan API key (berawalan{' '}
                      <code>AIzaSy...</code>) pada kolom <strong>Gemini API Key Pribadi</strong>,
                      lalu simpan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Panduan selalu dapat dibuka kapan saja</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            Tutup Panduan
          </button>
        </div>
      </div>
    </div>
  );
};

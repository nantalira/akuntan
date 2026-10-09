import {
  ArrowRight,
  BookOpen,
  Camera,
  MessageSquare,
  PieChart,
  Share2,
  Sparkles,
  Zap
} from 'lucide-react';
import type React from 'react';
import type { GuideTab } from './FeatureGuideModal';

interface OnboardingLaunchpadProps {
  onOpenGuide: (tab?: GuideTab) => void;
  onTryPrompt?: (prompt: string) => void;
  onSkip?: () => void;
}

const SAMPLE_PROMPTS = [
  {
    title: 'Kopi susu 18rb',
    emoji: '☕',
    description: 'Catat cepat pengeluaran ngopi'
  },
  {
    title: 'Makan siang padang 25rb bayar pake QRIS',
    emoji: '🍛',
    description: 'Kategori makanan + metode QRIS'
  },
  {
    title: 'Beli bensin 30rb bayar gopay',
    emoji: '⛽',
    description: 'Bensin kendaraan via e-wallet'
  },
  {
    title: 'Pinjamkan Budi 50rb',
    emoji: '🤝',
    description: 'Pencatatan piutang otomatis'
  }
];

export const OnboardingLaunchpad: React.FC<OnboardingLaunchpadProps> = ({
  onOpenGuide,
  onTryPrompt,
  onSkip
}) => {
  const handlePromptClick = (prompt: string) => {
    if (onTryPrompt) {
      onTryPrompt(prompt);
    } else {
      window.dispatchEvent(new CustomEvent('akuntan:open-chat', { detail: { prompt } }));
    }
  };

  return (
    <div className="py-6 px-4 sm:px-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 p-6 sm:p-8 text-white shadow-lg shadow-emerald-900/10">
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-emerald-100 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Mulai Buku Kas Cerdasmu</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
            Selamat Datang di Akuntan AI!
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-emerald-50 leading-relaxed">
            Belum ada transaksi tercatat. Mulai catat pengeluaran pertamamu dalam hitungan detik
            menggunakan AI multimodal, pesan suara, atau bagikan bukti QRIS dari m-Banking!
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handlePromptClick('Makan siang 25rb bayar pake QRIS')}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-extrabold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Coba Catat Pertama Kali</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGuide('qris')}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Lihat Panduan Fitur</span>
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="px-4 py-2.5 rounded-xl bg-black/20 hover:bg-black/30 text-white font-bold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer"
                title="Lewati onboarding dan langsung masuk ke dashboard"
              >
                <span>Lewati ke Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Quick-Try Prompt Chips */}
      <div className="space-y-3 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
              Coba Klik Contoh Pengeluaran (1-Tap Fast Test):
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Klik salah satu untuk otomatis mengisi chat
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample.title}
              type="button"
              onClick={() => handlePromptClick(sample.title)}
              className="p-3 text-left rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200/70 hover:border-emerald-300 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0">{sample.emoji}</span>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 truncate">
                    "{sample.title}"
                  </p>
                  <p className="text-[10px] text-slate-400 group-hover:text-emerald-700 truncate mt-0.5">
                    {sample.description}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 shrink-0 ml-2 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>

      {/* 4 Feature Pillars Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-800 text-xs sm:text-sm px-1">
          Fitur Unggulan yang Dapat Kamu Gunakan:
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Pillar 1: QRIS PWA Share */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Favorit
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Share Bukti Bayar QRIS (PWA)</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Selesai bayar QRIS di m-banking (BCA, Mandiri, BRI, GoPay, dll), tekan "Share" dan
                pilih Akuntan AI. Data transaksi terisi otomatis tanpa ketik!
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenGuide('qris')}
              className="mt-3 pt-2 border-t border-slate-100 text-emerald-700 hover:text-emerald-800 text-xs font-bold flex items-center justify-between w-full group"
            >
              <span>Cara Pasang & Bagikan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Pillar 2: AI Chat & Voice */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Multimodal
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-xs">AI Chat & Pesan Suara</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Tulis pengeluaran seperti mengirim chat biasa atau rekam suara saat sedang di jalan.
                AI kami otomatis mengkategorikan dan menyimpan ke buku kas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenGuide('chat')}
              className="mt-3 pt-2 border-t border-slate-100 text-blue-700 hover:text-blue-800 text-xs font-bold flex items-center justify-between w-full group"
            >
              <span>Pelajari Contoh Perintah</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Pillar 3: Scan Struk Belanja OCR */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                  OCR Vision
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Scan Struk Belanja Fisik</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Foto nota kasir dari supermarket, restoran, atau cafe. AI membaca total belanja dan
                nama toko secara instan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenGuide('ocr')}
              className="mt-3 pt-2 border-t border-slate-100 text-purple-700 hover:text-purple-800 text-xs font-bold flex items-center justify-between w-full group"
            >
              <span>Cara Scan Struk</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Pillar 4: Kustomisasi Kategori & Budget */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <PieChart className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  Fleksibel
                </span>
              </div>
              <h4 className="font-bold text-slate-800 text-xs">Kategori & Limit Budget</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Sesuaikan pos pengeluaran sesuai kebutuhanmu dengan emoji kustom, serta atur batas
                anggaran bulanan untuk mengontrol pengeluaran.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenGuide('categories')}
              className="mt-3 pt-2 border-t border-slate-100 text-amber-700 hover:text-amber-800 text-xs font-bold flex items-center justify-between w-full group"
            >
              <span>Kelola Kategori & Budget</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Skip Onboarding Banner (if user wants to skip to dashboard) */}
      {onSkip && (
        <div className="pt-2 pb-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left border-t border-slate-200/80">
          <div>
            <p className="text-xs font-bold text-slate-700">
              Sudah paham atau ingin melihat dashboard langsung?
            </p>
            <p className="text-[11px] text-slate-400">
              Kamu bisa kembali membuka panduan ini kapan saja lewat tombol (?) di menu atas.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>Buka Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

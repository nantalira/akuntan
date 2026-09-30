import { Award, Calendar, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type React from 'react';
import { formatRupiah } from './Dashboard';

export interface SmartInsightsData {
  mom: {
    currentPeriodTotal: number;
    prevPeriodTotal: number;
    diffAmount: number;
    diffPercentage: number;
    prevMonthLabel: string;
    isSameDayCutoff: boolean;
    cutoffDay: number | null;
  };
  largestTransaction: {
    id: number;
    name: string;
    amount: number;
    category: string;
    date: string;
  } | null;
  peakDay: {
    dayName: string;
    count: number;
    total: number;
  } | null;
}

interface SmartInsightsCardProps {
  insights?: SmartInsightsData;
  displayMonthName: string;
}

export const SmartInsightsCard: React.FC<SmartInsightsCardProps> = ({
  insights,
  displayMonthName
}) => {
  if (!insights) return null;

  const { mom, largestTransaction, peakDay } = insights;
  const isSaving = mom.diffPercentage <= 0;
  const absPercentage = Math.abs(mom.diffPercentage);

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Smart Insights & Pola Belanja
            </h3>
            <p className="text-xs text-slate-400">
              Analisis otomatis kebiasaan pengeluaran bulan {displayMonthName}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 1. Komparasi MoM (Month-over-Month) */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            mom.prevPeriodTotal === 0
              ? 'bg-slate-50/70 border-slate-200/70'
              : isSaving
                ? 'bg-emerald-50/40 border-emerald-200/80'
                : 'bg-amber-50/50 border-amber-200/80'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Komparasi Bulan Lalu
            </span>
            {mom.prevPeriodTotal > 0 && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isSaving ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isSaving ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <TrendingUp className="w-3 h-3" />
                )}
                {absPercentage}% {isSaving ? 'Hemat' : 'Naik'}
              </span>
            )}
          </div>

          {mom.prevPeriodTotal > 0 ? (
            <>
              <p
                className={`text-sm font-bold ${isSaving ? 'text-emerald-800' : 'text-amber-900'}`}
              >
                {isSaving
                  ? `${absPercentage}% lebih hemat dari bulan lalu`
                  : `${absPercentage}% lebih tinggi dari bulan lalu`}
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {mom.isSameDayCutoff && mom.cutoffDay
                  ? `Periode 1–${mom.cutoffDay} ${mom.prevMonthLabel.split(' ')[0]}: `
                  : `Total ${mom.prevMonthLabel}: `}
                <span className="font-semibold text-slate-700">
                  {formatRupiah(mom.prevPeriodTotal)}
                </span>
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 mt-1">
              Belum ada riwayat transaksi pada periode yang sama di bulan {mom.prevMonthLabel}.
            </p>
          )}
        </div>

        {/* 2. Transaksi Terbesar */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Pengeluaran Terbesar
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>

          {largestTransaction ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {largestTransaction.name}
                </p>
                <span className="text-sm font-black text-rose-600 shrink-0">
                  {formatRupiah(largestTransaction.amount)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {largestTransaction.category}
                </span>
                <span className="text-[11px] text-slate-400">{largestTransaction.date}</span>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Belum ada transaksi tercatat bulan ini.</p>
          )}
        </div>

        {/* 3. Hari Paling Konsumtif */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Hari Paling Konsumtif
            </span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>

          {peakDay ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">Hari {peakDay.dayName}</p>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {peakDay.count}x transaksi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Total belanja di hari {peakDay.dayName}:{' '}
                <span className="font-semibold text-slate-700">{formatRupiah(peakDay.total)}</span>
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Belum cukup data pola mingguan.</p>
          )}
        </div>
      </div>
    </div>
  );
};

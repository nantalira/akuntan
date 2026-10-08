import { Award, Calendar, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { getAuthHeaders } from '../api';
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
  selectedMonth?: string;
}

export const SmartInsightsCard: React.FC<SmartInsightsCardProps> = ({
  insights,
  displayMonthName,
  selectedMonth
}) => {
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMonth) {
      setAiInsight(null);
      setAiError(null);
    }
  }, [selectedMonth]);

  const handleRequestAiInsight = async () => {
    if (isLoadingAi) return;
    setIsLoadingAi(true);
    setAiError(null);

    try {
      const res = await fetch('/api/analytics/ai-insight', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ month: selectedMonth })
      });

      const json = await res.json<{
        success: boolean;
        data?: { insight: string; month: string };
        error?: string;
      }>();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Gagal memuat evaluasi AI');
      }

      setAiInsight(json.data.insight);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Terjadi kendala saat meminta evaluasi AI');
    } finally {
      setIsLoadingAi(false);
    }
  };

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

      {/* 4. AI Financial Evaluation Section */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
        {/* Balon Saran Finansial AI */}
        {aiInsight && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-50/80 via-purple-50/60 to-indigo-50/80 border border-violet-200/80 shadow-xs relative animate-fade-in">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-violet-800">
                <Sparkles className="w-4 h-4 text-violet-600 animate-pulse" />
                <span>Evaluasi Finansial Akuntan AI</span>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                Gemini AI
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
              "{aiInsight}"
            </p>
          </div>
        )}

        {/* Error notice if any */}
        {aiError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
            <span>{aiError}</span>
            <button
              type="button"
              onClick={() => setAiError(null)}
              className="text-rose-400 hover:text-rose-600 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Action Button: Minta Evaluasi AI */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-slate-400">
            {aiInsight
              ? 'Evaluasi dihasilkan berdasarkan pola belanja bulan ini'
              : 'Dapatkan evaluasi naratif & saran penghematan taktis dari Gemini AI'}
          </div>

          <button
            type="button"
            onClick={handleRequestAiInsight}
            disabled={isLoadingAi}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] shadow-xs cursor-pointer ${
              isLoadingAi
                ? 'bg-violet-100 text-violet-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/20 hover:shadow-violet-500/30'
            }`}
          >
            {isLoadingAi ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Menganalisis Finansial...</span>
              </>
            ) : aiInsight ? (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Analisis Ulang AI</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>✨ Minta Evaluasi AI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

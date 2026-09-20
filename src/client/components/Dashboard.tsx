import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Wallet
} from 'lucide-react';
import type React from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { BudgetHealthCard } from './BudgetHealthCard';

export interface AnalyticsData {
  month: string;
  year: string;
  monthTotal: number;
  todayTotal: number;
  categoryBreakdown: Array<{
    category: string;
    total: number;
    percentage: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    label: string;
    total: number;
  }>;
  debts: {
    totalOwedToUs: number;
    totalWeOwe: number;
  };
}

interface DashboardProps {
  data: AnalyticsData | null;
  selectedMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  isLoading: boolean;
  budgets?: Record<string, number>;
  onSaveBudgets?: (newBudgets: Array<{ category: string; monthlyLimit: number }>) => Promise<void>;
}

const CATEGORY_COLORS: Record<string, string> = {
  Makan: '#f97316', // Orange
  Jajan: '#eab308', // Yellow
  Primer: '#3b82f6', // Blue
  Motor: '#64748b', // Slate
  Olga: '#10b981', // Emerald
  Belanja: '#8b5cf6' // Purple
};

export const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val);
};

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  selectedMonth,
  onMonthChange,
  isLoading,
  budgets = {},
  onSaveBudgets = async () => {}
}) => {
  // Navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const prev = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(prev);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(next);
  };

  const [yearStr, monthStr] = selectedMonth.split('-');
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ];
  const displayMonthName = `${monthNames[parseInt(monthStr, 10) - 1]} ${yearStr}`;

  return (
    <div className="space-y-6">
      {/* Month Selector Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-lg leading-tight">{displayMonthName}</h2>
            <p className="text-xs text-slate-400">Ringkasan pengeluaran periode ini</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
            title="Bulan berikutnya"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Bulan Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">
            {data ? formatRupiah(data.monthTotal) : '...'}
          </p>
          <div className="h-1 w-full bg-emerald-500 rounded-full mt-3 opacity-20" />
        </div>

        {/* Total Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-black text-slate-800 tracking-tight">
            {data ? formatRupiah(data.todayTotal) : '...'}
          </p>
          <div className="h-1 w-full bg-blue-500 rounded-full mt-3 opacity-20" />
        </div>

        {/* Total Owed To Us (Piutang) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Piutang (Ditalangi)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-black text-emerald-600 tracking-tight">
            {data ? formatRupiah(data.debts.totalOwedToUs) : '...'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Uang yang harus kembali</p>
        </div>

        {/* Total We Owe (Hutang) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Hutang Kita
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-black text-rose-600 tracking-tight">
            {data ? formatRupiah(data.debts.totalWeOwe) : '...'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Kewajiban bayar ke orang</p>
        </div>
      </div>

      {/* Budget Health Card */}
      <BudgetHealthCard
        categoryBreakdown={data?.categoryBreakdown || []}
        budgets={budgets}
        onSaveBudgets={onSaveBudgets}
      />

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (Donut Chart) - 5 Cols */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">Breakdown Kategori</h3>
            <p className="text-xs text-slate-400 mb-4">
              Persentase pengeluaran bulan {displayMonthName}
            </p>
          </div>

          <div className="h-60 w-full relative flex items-center justify-center">
            {data && data.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {data.categoryBreakdown.map((entry) => (
                      <Cell
                        key={`cell-${entry.category}`}
                        fill={CATEGORY_COLORS[entry.category] || '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => formatRupiah(val)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                Belum ada transaksi di bulan ini
              </div>
            )}
          </div>

          {/* Category Legends */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
            {data?.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat.category] || '#94a3b8' }}
                  />
                  <span className="text-slate-600 font-medium">{cat.category}</span>
                </div>
                <span className="font-bold text-slate-700">{cat.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend (Bar Chart) - 7 Cols */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">Tren Pengeluaran {yearStr}</h3>
            <p className="text-xs text-slate-400 mb-4">
              Grafik riwayat pengeluaran Januari s/d Desember {yearStr}
            </p>
          </div>

          <div className="h-64 w-full">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlyTrend}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: number) => formatRupiah(val)}
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} name="Pengeluaran" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Memuat data grafik...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MoreVertical,
  Pencil,
  Search,
  Sparkles,
  Trash2
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { api } from '../api';
import { formatRupiah } from './Dashboard';
import { EditTransactionDrawer } from './EditTransactionDrawer';

export interface TransactionItem {
  id: number;
  name: string;
  amount: number;
  date: string;
  time: string;
  category: string;
  debtor: string | null;
  creditor: string | null;
  debtAmount: number | null;
  isDebtSettled?: number;
  debtSettledAt?: string | null;
  notes: string | null;
  paymentMethod?: string | null;
  source?: string | null;
  createdAt: string;
}

interface TransactionListProps {
  transactions: TransactionItem[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
}

const CATEGORIES = ['Semua', 'Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'];

const formatTransactionDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateStr;
  }
};

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  selectedMonth,
  onMonthChange,
  selectedDate,
  onDateChange,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onRefresh
}) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [menuOpenTxId, setMenuOpenTxId] = useState<number | null>(null);

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(
    yesterday
  );

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m - 2, 1);
    const prev = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(prev);
    onDateChange('all');
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const date = new Date(y, m, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(next);
    onDateChange('all');
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
  const currentMonthStr = todayStr.slice(0, 7);
  const isCurrentMonth = selectedMonth === currentMonthStr;

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus transaksi ini dari catatan?')) return;
    setDeletingId(id);
    try {
      await api.api.transactions[':id'].$delete({
        param: { id: id.toString() }
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Riwayat Transaksi</h3>
          <p className="text-xs text-slate-400">Daftar transaksi yang tercatat di Cloudflare D1</p>
        </div>

        <div className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Cari transaksi..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:bg-white transition-all"
            />
          </div>

          <a
            href={`/api/export?month=${selectedMonth}`}
            download={`akuntan-transaksi-${selectedMonth}.csv`}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition-all border border-emerald-200 shrink-0"
            title={`Unduh seluruh transaksi ${displayMonthName} ke format CSV`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ekspor</span> CSV
          </a>
        </div>
      </div>

      {/* Month & Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
        {/* Month Selector */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-xl">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-600 transition-colors"
            title="Bulan sebelumnya"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold text-slate-700 px-1 select-none">
            {displayMonthName}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-600 transition-colors"
            title="Bulan berikutnya"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => onDateChange('all')}
            className={`text-xs px-3 py-1 rounded-xl font-medium transition-all shrink-0 ${
              selectedDate === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            Semua
          </button>

          {isCurrentMonth && (
            <>
              <button
                type="button"
                onClick={() => onDateChange(todayStr)}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition-all shrink-0 ${
                  selectedDate === todayStr
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Hari Ini
              </button>

              <button
                type="button"
                onClick={() => onDateChange(yesterdayStr)}
                className={`text-xs px-3 py-1 rounded-xl font-medium transition-all shrink-0 ${
                  selectedDate === yesterdayStr
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                Kemarin
              </button>
            </>
          )}

          {/* Custom Date Input */}
          <input
            type="date"
            value={selectedDate !== 'all' ? selectedDate : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                const m = val.slice(0, 7);
                if (m !== selectedMonth) {
                  onMonthChange(m);
                }
                onDateChange(val);
              } else {
                onDateChange('all');
              }
            }}
            className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-300"
            title="Pilih tanggal spesifik"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 ${
              selectedCategory === cat
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Transactions Table / List */}
      <div className="divide-y divide-slate-100">
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Tidak ada transaksi yang cocok dengan filter.
          </div>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 -mx-2 px-2 rounded-xl transition-colors group"
            >
              {/* Left: Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm truncate">{tx.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    {tx.category}
                  </span>
                  {tx.paymentMethod && tx.paymentMethod !== 'Cash' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold"
                      title={`Dibayar menggunakan ${tx.paymentMethod}`}
                    >
                      💳 {tx.paymentMethod}
                    </span>
                  )}
                  {tx.source === 'qris_webhook' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 font-semibold flex items-center gap-0.5"
                      title="Tercatat otomatis dari Webhook QRIS Bank"
                    >
                      ⚡ Webhook QRIS
                    </span>
                  )}
                  {tx.source === 'share_target' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold flex items-center gap-0.5"
                      title="Tercatat dari fitur Bagikan (Share) Bukti QRIS"
                    >
                      📲 Share QRIS
                    </span>
                  )}
                  {tx.source === 'ai' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium flex items-center gap-0.5"
                      title="Dicatat otomatis menggunakan Gemini AI"
                    >
                      <Sparkles className="w-2.5 h-2.5" /> AI
                    </span>
                  )}
                  {tx.source === 'local_parser' && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium flex items-center gap-0.5"
                      title="Dicatat via chat menggunakan parser lokal"
                    >
                      ⚡ Lokal
                    </span>
                  )}
                  {tx.debtor && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium flex items-center gap-0.5">
                      <ArrowUpRight className="w-2.5 h-2.5" /> Nalangi {tx.debtor}
                    </span>
                  )}
                  {tx.creditor && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium flex items-center gap-0.5">
                      <ArrowDownLeft className="w-2.5 h-2.5" /> Ditalangi {tx.creditor}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 text-[11px] text-slate-400 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-400" /> {formatTransactionDate(tx.date)}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {tx.time}
                  </span>
                  {tx.notes && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="truncate max-w-[200px] text-slate-500 italic">
                        "{tx.notes}"
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: Amount & Actions (More Options) */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="font-bold text-slate-800 text-sm sm:text-base mr-1">
                  {formatRupiah(tx.amount)}
                </span>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpenTxId(menuOpenTxId === tx.id ? null : tx.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Menu opsi transaksi"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuOpenTxId === tx.id && (
                    <>
                      <button
                        type="button"
                        aria-label="Tutup menu"
                        tabIndex={-1}
                        className="fixed inset-0 z-30 cursor-default bg-transparent"
                        onClick={() => setMenuOpenTxId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200/90 py-1 z-40 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenTxId(null);
                            setEditingTx(tx);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                          <span>Edit Transaksi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenTxId(null);
                            handleDelete(tx.id);
                          }}
                          disabled={deletingId === tx.id}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Transaction Bottom Drawer */}
      <EditTransactionDrawer
        transaction={editingTx}
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        onSuccess={() => {
          onRefresh();
        }}
      />
    </div>
  );
};

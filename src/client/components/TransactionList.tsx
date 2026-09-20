import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Clock,
  Download,
  Search,
  Trash2
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { api } from '../api';
import { formatRupiah } from './Dashboard';

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
  notes: string | null;
  createdAt: string;
}

interface TransactionListProps {
  transactions: TransactionItem[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
}

const CATEGORIES = ['Semua', 'Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'];

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  selectedCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  onRefresh
}) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
            href="/api/export"
            download="akuntan-transaksi.csv"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition-all border border-emerald-200 shrink-0"
            title="Unduh seluruh data transaksi ke format CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ekspor</span> CSV
          </a>
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
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  {tx.category.slice(0, 2)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 text-sm truncate">{tx.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      {tx.category}
                    </span>
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

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {tx.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {tx.time}
                    </span>
                    {tx.notes && (
                      <span className="truncate max-w-[200px] text-slate-500 italic">
                        "{tx.notes}"
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Amount & Delete Button */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-slate-800 text-sm sm:text-base">
                  {formatRupiah(tx.amount)}
                </span>

                <button
                  onClick={() => handleDelete(tx.id)}
                  disabled={deletingId === tx.id}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Hapus transaksi"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

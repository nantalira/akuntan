import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Pencil,
  X
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '../api';
import { formatRupiah } from './Dashboard';
import { EditTransactionDrawer } from './EditTransactionDrawer';
import type { TransactionItem } from './TransactionList';

interface AllDebtsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'piutang' | 'hutang';
  onNavigateToDebts?: () => void;
  onRefresh?: () => void;
}

export const AllDebtsDrawer: React.FC<AllDebtsDrawerProps> = ({
  isOpen,
  onClose,
  initialType = 'piutang',
  onNavigateToDebts,
  onRefresh
}) => {
  const [selectedType, setSelectedType] = useState<'piutang' | 'hutang'>(initialType);
  const [piutangItems, setPiutangItems] = useState<TransactionItem[]>([]);
  const [hutangItems, setHutangItems] = useState<TransactionItem[]>([]);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUnsettledDebts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/debts/all-unsettled', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const json = await res.json<{
        success: boolean;
        data?: {
          total: number;
          piutang: TransactionItem[];
          hutang: TransactionItem[];
        };
        error?: string;
      }>();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Gagal memuat rincian perhutangan');
      }

      setPiutangItems(json.data.piutang);
      setHutangItems(json.data.hutang);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType);
      fetchUnsettledDebts();
    } else {
      setPiutangItems([]);
      setHutangItems([]);
      setError(null);
    }
  }, [isOpen, initialType, fetchUnsettledDebts]);

  if (!isOpen) return null;

  const currentItems = selectedType === 'piutang' ? piutangItems : hutangItems;
  const totalAmount = currentItems.reduce(
    (acc, cur) => acc + (cur.debtAmount && cur.debtAmount > 0 ? cur.debtAmount : cur.amount),
    0
  );

  const handleSettle = async (txId: number) => {
    setActionId(txId);
    setError(null);
    try {
      const res = await fetch(`/api/debts/transactions/${txId}/settle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const json = await res.json<{ success: boolean; error?: string }>();
      if (!json.success) throw new Error(json.error || 'Gagal melunasi item');

      await fetchUnsettledDebts();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal melunasi transaksi');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200">
        {/* Mobile handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                selectedType === 'piutang'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {selectedType === 'piutang' ? (
                <ArrowUpRight className="w-5 h-5" />
              ) : (
                <ArrowDownLeft className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">
                  {selectedType === 'piutang' ? 'Daftar Piutang Aktif' : 'Daftar Hutang Aktif'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                  All-Time
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {selectedType === 'piutang'
                  ? 'Uang yang ditalangi dan belum kembali'
                  : 'Kewajiban bayar yang belum dilunasi'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Pill Bar */}
        <div className="px-4 sm:px-5 pt-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedType('piutang')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                selectedType === 'piutang'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Piutang ({piutangItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('hutang')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                selectedType === 'hutang'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Hutang ({hutangItems.length})</span>
            </button>
          </div>
        </div>

        {/* Total Summary */}
        <div className="px-4 sm:px-5 pt-3">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              selectedType === 'piutang'
                ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900'
                : 'bg-rose-50/50 border-rose-200/80 text-rose-900'
            }`}
          >
            <span>Total {selectedType === 'piutang' ? 'Piutang' : 'Hutang'} Belum Lunas:</span>
            <span className="font-black text-sm">{formatRupiah(totalAmount)}</span>
          </div>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-xs">Memuat daftar perhutangan...</p>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
              <p className="text-xs font-bold text-slate-700">Tidak Ada Item Belum Lunas!</p>
              <p className="text-[11px] max-w-xs mx-auto text-slate-400">
                Semua catatan {selectedType === 'piutang' ? 'piutang' : 'hutang'} sudah
                diselesaikan.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {currentItems.map((item) => {
                const contact = selectedType === 'piutang' ? item.debtor : item.creditor;
                const itemDebtAmount =
                  item.debtAmount && item.debtAmount > 0 ? item.debtAmount : item.amount;
                const isProcessing = actionId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                          👤 {contact}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.category}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditingTx(item)}
                        className="font-bold text-slate-800 text-xs sm:text-sm truncate text-left hover:text-emerald-600 hover:underline transition-colors block"
                        title="Klik untuk edit transaksi"
                      >
                        {item.name}
                      </button>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" /> {item.date}
                        </span>
                        {item.notes && (
                          <span className="italic truncate max-w-[150px]">"{item.notes}"</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1.5">
                      <div className="font-black text-slate-800 text-xs sm:text-sm">
                        {formatRupiah(itemDebtAmount)}
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingTx(item)}
                          className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-200 transition-colors shadow-2xs flex items-center justify-center"
                          title="Edit detail transaksi"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSettle(item.id)}
                          disabled={isProcessing}
                          title={selectedType === 'piutang' ? 'Tandai Diterima' : 'Lunasi'}
                          className={`p-2 rounded-xl transition-all flex items-center justify-center shadow-2xs ${
                            selectedType === 'piutang'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                              : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95'
                          }`}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Link to Debt Page */}
        {onNavigateToDebts && (
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">Ingin melihat rekap saldo per kontak?</span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToDebts();
              }}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
            >
              <span>Buka Papan Hutang</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Edit Transaction Drawer */}
      <EditTransactionDrawer
        transaction={editingTx}
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        onSuccess={() => {
          setEditingTx(null);
          fetchUnsettledDebts();
          onRefresh?.();
        }}
      />
    </div>
  );
};

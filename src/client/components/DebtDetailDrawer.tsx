import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  CornerUpLeft,
  Loader2,
  Pencil,
  Users,
  X
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '../api';
import { formatRupiah } from './Dashboard';
import type { DebtContact } from './DebtBoard';
import { EditTransactionDrawer } from './EditTransactionDrawer';
import type { TransactionItem } from './TransactionList';

interface DebtDetailDrawerProps {
  contact: DebtContact | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const DebtDetailDrawer: React.FC<DebtDetailDrawerProps> = ({
  contact,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'settled'>('active');
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchContactTransactions = useCallback(async () => {
    if (!contact) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/debts/${encodeURIComponent(contact.contactName)}/transactions`,
        {
          headers: getAuthHeaders(),
          credentials: 'include'
        }
      );
      const json = await res.json<{
        success: boolean;
        data?: {
          contactName: string;
          totalItems: number;
          active: TransactionItem[];
          settled: TransactionItem[];
        };
        error?: string;
      }>();

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Gagal memuat rincian transaksi kontak');
      }

      setTransactions([...json.data.active, ...json.data.settled]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat');
    } finally {
      setLoading(false);
    }
  }, [contact]);

  useEffect(() => {
    if (isOpen && contact) {
      setActiveTab('active');
      fetchContactTransactions();
    } else {
      setTransactions([]);
      setError(null);
    }
  }, [isOpen, contact, fetchContactTransactions]);

  if (!isOpen || !contact) return null;

  const activeItems = transactions.filter((t) => (t.isDebtSettled ?? 0) === 0);
  const settledItems = transactions.filter((t) => (t.isDebtSettled ?? 0) === 1);

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

      await fetchContactTransactions();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal melunasi transaksi');
    } finally {
      setActionId(null);
    }
  };

  const handleUnsettle = async (txId: number) => {
    setActionId(txId);
    setError(null);
    try {
      const res = await fetch(`/api/debts/transactions/${txId}/unsettle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const json = await res.json<{ success: boolean; error?: string }>();
      if (!json.success) throw new Error(json.error || 'Gagal membatalkan pelunasan item');

      await fetchContactTransactions();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan status lunas');
    } finally {
      setActionId(null);
    }
  };

  const isWeOwe = contact.netBalance < 0;
  const isBalanced = contact.netBalance === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200">
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-sm uppercase">
              {contact.contactName.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800 text-base">{contact.contactName}</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isBalanced
                      ? 'bg-slate-200 text-slate-600'
                      : isWeOwe
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {isBalanced ? 'Lunas' : isWeOwe ? 'Kita Berhutang' : 'Mereka Berhutang'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Rincian seluruh transaksi hutang & piutang</p>
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

        {/* Balance Card Banner */}
        <div className="px-4 sm:px-5 pt-3">
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              isBalanced
                ? 'bg-slate-50 border-slate-200'
                : isWeOwe
                  ? 'bg-rose-50/60 border-rose-200/80 text-rose-900'
                  : 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900'
            }`}
          >
            <div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Posisi Saldo Bersih
              </span>
              <span
                className={`text-lg font-black tracking-tight ${
                  isBalanced ? 'text-slate-700' : isWeOwe ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {formatRupiah(Math.abs(contact.netBalance))}
              </span>
            </div>

            <div className="text-right text-[11px] space-y-0.5 text-slate-500">
              <div className="flex items-center justify-end gap-1">
                <span className="text-slate-400">Nalangi:</span>
                <span className="font-semibold text-slate-700">
                  {formatRupiah(contact.totalOwedToUs)}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <span className="text-slate-400">Ditalangi:</span>
                <span className="font-semibold text-slate-700">
                  {formatRupiah(contact.totalWeOwe)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs: Belum Lunas vs Riwayat Selesai */}
        <div className="px-4 sm:px-5 pt-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Belum Lunas</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full">
                {activeItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settled')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'settled'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Riwayat Selesai</span>
              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full">
                {settledItems.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content List */}
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
              <p className="text-xs">Memuat daftar transaksi...</p>
            </div>
          ) : activeTab === 'active' ? (
            activeItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                <p className="text-xs font-bold text-slate-700">Semua Tagihan Lunas!</p>
                <p className="text-[11px] max-w-xs mx-auto text-slate-400">
                  Tidak ada kewajiban aktif antara kamu dan {contact.contactName}.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeItems.map((item) => {
                  const isNalangi = Boolean(item.debtor);
                  const itemDebtAmount =
                    item.debtAmount && item.debtAmount > 0 ? item.debtAmount : item.amount;
                  const isProcessing = actionId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                              isNalangi
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isNalangi ? (
                              <>
                                <ArrowUpRight className="w-2.5 h-2.5" /> Nalangi
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="w-2.5 h-2.5" /> Ditalangi
                              </>
                            )}
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
                            title={isNalangi ? 'Tandai Diterima' : 'Lunasi'}
                            className={`p-2 rounded-xl transition-all flex items-center justify-center shadow-2xs ${
                              isNalangi
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
            )
          ) : settledItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Users className="w-7 h-7 mx-auto text-slate-300" />
              <p className="text-xs">Belum ada riwayat transaksi yang dilunasi.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {settledItems.map((item) => {
                const isNalangi = Boolean(item.debtor);
                const itemDebtAmount =
                  item.debtAmount && item.debtAmount > 0 ? item.debtAmount : item.amount;
                const isProcessing = actionId === item.id;

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-slate-400"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                          {isNalangi ? 'Nalangi' : 'Ditalangi'}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Lunas
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-700 text-xs sm:text-sm line-through">
                        {item.name}
                      </h4>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{item.date}</span>
                        {item.debtSettledAt && (
                          <span>* Dilunasi {item.debtSettledAt.slice(0, 10)}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1.5">
                      <div className="font-bold text-slate-500 text-xs sm:text-sm">
                        {formatRupiah(itemDebtAmount)}
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingTx(item)}
                          className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-white border border-slate-200 transition-colors flex items-center justify-center"
                          title="Edit detail transaksi"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUnsettle(item.id)}
                          disabled={isProcessing}
                          className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition-all flex items-center justify-center shadow-2xs"
                          title="Batalkan status lunas (Undo)"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CornerUpLeft className="w-3.5 h-3.5" />
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
      </div>

      {/* Edit Transaction Drawer */}
      <EditTransactionDrawer
        transaction={editingTx}
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        onSuccess={() => {
          setEditingTx(null);
          fetchContactTransactions();
          onRefresh();
        }}
      />
    </div>
  );
};

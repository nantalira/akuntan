import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Tag,
  Users,
  X
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { getAuthHeaders } from '../api';
import { useCategories } from '../hooks/useCategories';
import type { TransactionItem } from './TransactionList';

interface EditTransactionDrawerProps {
  transaction: TransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  'Cash',
  'QRIS',
  'BCA',
  'Mandiri',
  'BRI',
  'BNI',
  'GoPay',
  'OVO',
  'DANA',
  'ShopeePay',
  'Transfer'
];

export const EditTransactionDrawer: React.FC<EditTransactionDrawerProps> = ({
  transaction,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { categories } = useCategories();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Makan');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  // Perhutangan state
  const [hasDebt, setHasDebt] = useState(false);
  const [debtType, setDebtType] = useState<'nalangi' | 'ditalangi'>('nalangi');
  const [contactName, setContactName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transaction) {
      setName(transaction.name || '');
      setAmount(transaction.amount?.toString() || '');
      setCategory(transaction.category || 'Makan');
      setDate(transaction.date || '');
      setTime(transaction.time || '12:00:00');
      setPaymentMethod(transaction.paymentMethod || 'Cash');
      setNotes(transaction.notes || '');

      const isDebtor = Boolean(transaction.debtor);
      const isCreditor = Boolean(transaction.creditor);
      if (isDebtor) {
        setHasDebt(true);
        setDebtType('nalangi');
        setContactName(transaction.debtor || '');
        setDebtAmount(
          transaction.debtAmount ? transaction.debtAmount.toString() : transaction.amount.toString()
        );
      } else if (isCreditor) {
        setHasDebt(true);
        setDebtType('ditalangi');
        setContactName(transaction.creditor || '');
        setDebtAmount(
          transaction.debtAmount ? transaction.debtAmount.toString() : transaction.amount.toString()
        );
      } else {
        setHasDebt(false);
        setDebtType('nalangi');
        setContactName('');
        setDebtAmount('');
      }
      setError(null);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama transaksi wajib diisi');
      return;
    }
    const numAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!numAmount || numAmount <= 0) {
      setError('Nominal harus lebih dari 0');
      return;
    }
    if (!date) {
      setError('Tanggal transaksi wajib diisi');
      return;
    }

    let parsedDebtor: string | null = null;
    let parsedCreditor: string | null = null;
    let parsedDebtAmount = 0;

    if (hasDebt) {
      if (!contactName.trim()) {
        setError('Nama kontak hutang/piutang wajib diisi');
        return;
      }
      const numDebtAmt = parseInt(debtAmount.replace(/[^0-9]/g, ''), 10) || numAmount;
      if (debtType === 'nalangi') {
        parsedDebtor = contactName.trim().toUpperCase();
      } else {
        parsedCreditor = contactName.trim().toUpperCase();
      }
      parsedDebtAmount = numDebtAmt;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          amount: numAmount,
          category,
          date,
          time: time.length === 5 ? `${time}:00` : time || '12:00:00',
          paymentMethod,
          notes: notes.trim() || null,
          debtor: parsedDebtor,
          creditor: parsedCreditor,
          debtAmount: parsedDebtAmount
        })
      });

      const json = await res.json<{ success: boolean; error?: string }>();
      if (!json.success) {
        throw new Error(json.error || 'Gagal memperbarui transaksi');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 animate-in slide-in-from-bottom duration-200">
        {/* Handle bar on mobile */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Edit Transaksi</h3>
              <p className="text-xs text-slate-400">ID #{transaction.id} * Ubah detail data</p>
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nama Transaksi */}
          <div>
            <label htmlFor="edit-tx-name" className="block font-semibold text-slate-700 mb-1">
              Nama Transaksi
            </label>
            <input
              id="edit-tx-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nasi Padang, Bensin, Sabun"
              required
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-xs"
            />
          </div>

          {/* Nominal */}
          <div>
            <label htmlFor="edit-tx-amount" className="block font-semibold text-slate-700 mb-1">
              Nominal (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                Rp
              </span>
              <input
                id="edit-tx-amount"
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(raw);
                  if (hasDebt && !debtAmount) {
                    setDebtAmount(raw);
                  }
                }}
                placeholder="0"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-xs"
              />
            </div>
          </div>

          {/* Kategori Pills */}
          <div>
            <span className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Kategori
            </span>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => {
                const isSelected = category.toLowerCase() === cat.name.toLowerCase();
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`py-2 px-2 rounded-xl border font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span className="truncate">{cat.name}</span>
                    {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tanggal & Jam */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-tx-date"
                className="block font-semibold text-slate-700 mb-1 flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Tanggal
              </label>
              <input
                id="edit-tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-xs"
              />
            </div>

            <div>
              <label
                htmlFor="edit-tx-time"
                className="block font-semibold text-slate-700 mb-1 flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Jam
              </label>
              <input
                id="edit-tx-time"
                type="time"
                step="1"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-xs"
              />
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label
              htmlFor="edit-tx-payment-method"
              className="block font-semibold text-slate-700 mb-1 flex items-center gap-1"
            >
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              Metode Pembayaran
            </label>
            <select
              id="edit-tx-payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-xs"
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          {/* Catatan */}
          <div>
            <label htmlFor="edit-tx-notes" className="block font-semibold text-slate-700 mb-1">
              Catatan Tambahan
            </label>
            <input
              id="edit-tx-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan belanja, keterangan toko, dll."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white transition-all text-xs"
            />
          </div>

          {/* Bagian Perhutangan / Talangan */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDebt}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasDebt(checked);
                    if (checked && !debtAmount) {
                      setDebtAmount(amount);
                    }
                  }}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span className="font-bold text-slate-800">Libatkan Hutang / Talangan</span>
              </label>
              <Users className="w-4 h-4 text-slate-400" />
            </div>

            {hasDebt && (
              <div className="space-y-3 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
                {/* Jenis Hutang */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDebtType('nalangi')}
                    className={`flex-1 py-1.5 px-2 rounded-xl border text-center font-bold transition-all ${
                      debtType === 'nalangi'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    ↗️ Saya Nalangi (Piutang)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtType('ditalangi')}
                    className={`flex-1 py-1.5 px-2 rounded-xl border text-center font-bold transition-all ${
                      debtType === 'ditalangi'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-white text-slate-500 border-slate-200'
                    }`}
                  >
                    ↙️ Saya Ditalangi (Hutang)
                  </button>
                </div>

                {/* Nama Kontak */}
                <div>
                  <label
                    htmlFor="edit-tx-contact-name"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Nama Kontak
                  </label>
                  <input
                    id="edit-tx-contact-name"
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value.toUpperCase())}
                    placeholder="e.g. DIAN, BUDI, AYAH"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs"
                  />
                </div>

                {/* Nominal Talangan */}
                <div>
                  <label
                    htmlFor="edit-tx-debt-amount"
                    className="block text-[11px] font-semibold text-slate-600 mb-1"
                  >
                    Nominal Talangan (Rp)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      id="edit-tx-debt-amount"
                      type="text"
                      inputMode="numeric"
                      value={debtAmount}
                      onChange={(e) => setDebtAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={amount || '0'}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 font-semibold rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

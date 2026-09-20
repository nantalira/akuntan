import { Check, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

const CATEGORIES = ['Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'] as const;

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBudgets: Record<string, number>;
  onSave: (budgets: Array<{ category: string; monthlyLimit: number }>) => Promise<void>;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  currentBudgets,
  onSave
}) => {
  const [limits, setLimits] = useState<Record<string, number>>(() => ({
    Makan: currentBudgets.Makan || 0,
    Jajan: currentBudgets.Jajan || 0,
    Primer: currentBudgets.Primer || 0,
    Motor: currentBudgets.Motor || 0,
    Olga: currentBudgets.Olga || 0,
    Belanja: currentBudgets.Belanja || 0
  }));

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleLimitChange = (cat: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    setLimits((prev) => ({ ...prev, [cat]: num }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = Object.entries(limits).map(([category, monthlyLimit]) => ({
        category,
        monthlyLimit
      }));
      await onSave(payload);
      onClose();
    } catch (err) {
      console.error('Failed to save budgets:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Target Anggaran Bulanan</h3>
            <p className="text-xs text-slate-500">Pasang batas pengeluaran maksimal per kategori</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {CATEGORIES.map((cat) => {
            const currentVal = limits[cat] || 0;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex justify-between text-sm font-medium text-slate-700">
                  <span>{cat}</span>
                  <span className="text-xs text-slate-400">
                    {currentVal > 0 ? `Rp ${currentVal.toLocaleString('id-ID')}` : 'Belum diatur'}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={currentVal === 0 ? '' : currentVal.toLocaleString('id-ID')}
                    onChange={(e) => handleLimitChange(cat, e.target.value)}
                    placeholder="Contoh: 1.500.000"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                </div>
              </div>
            );
          })}

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm rounded-xl transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Menyimpan...' : 'Simpan Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

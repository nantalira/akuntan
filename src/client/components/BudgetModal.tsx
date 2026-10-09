import { Check, Plus, Tag, X } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { CategoryManagerModal } from './CategoryManagerModal';

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
  const { categories, refetch: refetchCategories } = useCategories();
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [limits, setLimits] = useState<Record<string, number>>(() => ({ ...currentBudgets }));
  const [isSaving, setIsSaving] = useState(false);

  // Sync limits when currentBudgets or categories change
  useEffect(() => {
    setLimits((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const cat of categories) {
        if (next[cat.name] === undefined) {
          next[cat.name] = currentBudgets[cat.name] || 0;
        }
      }
      return next;
    });
  }, [categories, currentBudgets]);

  if (!isOpen) return null;

  const handleLimitChange = (cat: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    setLimits((prev) => ({ ...prev, [cat]: num }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = categories.map((cat) => ({
        category: cat.name,
        monthlyLimit: limits[cat.name] || 0
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
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Target Anggaran Bulanan</h3>
              <p className="text-xs text-slate-500">
                Pasang batas pengeluaran maksimal per kategori
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action: Kelola / Tambah Pos */}
          <div className="px-6 py-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span>{categories.length}/8 Kategori Pengeluaran</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs hover:bg-emerald-50 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Kelola / Tambah Pos</span>
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
            {categories.map((cat) => {
              const currentVal = limits[cat.name] || 0;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex justify-between text-sm font-medium text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span>{cat.emoji}</span>
                      <span className="font-semibold">{cat.name}</span>
                    </span>
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
                      onChange={(e) => handleLimitChange(cat.name, e.target.value)}
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

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          refetchCategories();
        }}
        onCategoriesUpdated={() => {
          refetchCategories();
        }}
      />
    </>
  );
};

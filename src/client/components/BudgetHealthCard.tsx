import { AlertTriangle, CheckCircle, Settings, ShieldAlert, Target } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { BudgetModal } from './BudgetModal';

interface CategoryBreakdownItem {
  category: string;
  total: number;
  percentage: number;
}

interface BudgetHealthCardProps {
  categoryBreakdown: CategoryBreakdownItem[];
  budgets: Record<string, number>;
  onSaveBudgets: (newBudgets: Array<{ category: string; monthlyLimit: number }>) => Promise<void>;
}

export const BudgetHealthCard: React.FC<BudgetHealthCardProps> = ({
  categoryBreakdown,
  budgets,
  onSaveBudgets
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Map category spent
  const spentMap: Record<string, number> = {};
  for (const item of categoryBreakdown) {
    spentMap[item.category] = item.total;
  }

  const categories = ['Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'];
  const hasAnyBudget = Object.values(budgets).some((v) => v > 0);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm md:text-base">
              Kesehatan Anggaran Bulan Ini
            </h3>
            <p className="text-xs text-slate-400">Pantau batas maksimal pengeluaran per pos</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Atur Anggaran</span>
        </button>
      </div>

      {!hasAnyBudget ? (
        <div className="py-6 px-4 bg-slate-50/70 rounded-xl text-center border border-dashed border-slate-200">
          <p className="text-xs text-slate-500 font-medium">
            Belum ada target anggaran yang ditentukan.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-2 text-xs font-bold text-emerald-600 hover:underline"
          >
            Klik di sini untuk mengatur batas bulanan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((cat) => {
            const limit = budgets[cat] || 0;
            const spent = spentMap[cat] || 0;
            if (limit === 0 && spent === 0) return null;

            const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const isOver = percent >= 100;
            const isWarning = percent >= 80 && percent < 100;

            let barColor = 'bg-emerald-500';
            let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            let StatusIcon = CheckCircle;

            if (isOver) {
              barColor = 'bg-rose-500';
              badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
              StatusIcon = ShieldAlert;
            } else if (isWarning) {
              barColor = 'bg-amber-500';
              badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
              StatusIcon = AlertTriangle;
            }

            return (
              <div
                key={cat}
                className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs text-slate-700">{cat}</span>
                    {limit > 0 && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${badgeColor}`}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {isOver ? 'OVERBUDGET' : `${percent}%`}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    Rp {spent.toLocaleString('id-ID')}{' '}
                    {limit > 0 && (
                      <span className="text-slate-400">/ {limit.toLocaleString('id-ID')}</span>
                    )}
                  </span>
                </div>

                {limit > 0 ? (
                  <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Batas belum ditentukan</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentBudgets={budgets}
        onSave={onSaveBudgets}
      />
    </div>
  );
};

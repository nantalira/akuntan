import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Users } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { api } from '../api';
import { formatRupiah } from './Dashboard';
import { DebtDetailDrawer } from './DebtDetailDrawer';

export interface DebtContact {
  id: number;
  contactName: string;
  totalOwedToUs: number; // Piutang
  totalWeOwe: number; // Hutang
  netBalance: number; // Piutang - Hutang
  updatedAt: string;
}

interface DebtBoardProps {
  debts: DebtContact[];
  onRefresh: () => void;
}

export const DebtBoard: React.FC<DebtBoardProps> = ({ debts, onRefresh }) => {
  const [selectedContact, setSelectedContact] = useState<DebtContact | null>(null);
  const [_settlingContact, setSettlingContact] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSettle = async (
    e: React.MouseEvent,
    contactName: string,
    target: 'we_owe' | 'owed_to_us'
  ) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      await api.api.debts.settle.$post({
        json: {
          contactName,
          target
        }
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to settle debt:', err);
    } finally {
      setIsSubmitting(false);
      setSettlingContact(null);
    }
  };

  if (debts.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-sm text-center">
        <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-700 text-base mb-1">Tidak Ada Catatan Hutang</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Kamu belum memiliki transaksi hutang maupun piutang. Coba sebut "Nalangi Dian 20rb" di
          chat untuk mencatat.
        </p>
      </div>
    );
  }

  // Keep selectedContact in sync with updated debts
  const currentSelected = selectedContact
    ? debts.find((d) => d.id === selectedContact.id) || selectedContact
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">Papan Perhutangan & Talangan</h3>
          <p className="text-xs text-slate-400">
            Klik kartu kontak untuk melihat rincian item & pelunasan
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full">
          {debts.length} Kontak Terdaftar
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {debts.map((contact) => {
          const isWeOwe = contact.netBalance < 0;
          const isBalanced = contact.netBalance === 0;

          return (
            // biome-ignore lint/a11y/useSemanticElements: card contains nested quick settlement button
            <div
              key={contact.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedContact(contact)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedContact(contact);
                }
              }}
              className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] group text-left ${
                isBalanced
                  ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  : isWeOwe
                    ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300 hover:shadow-rose-100/50'
                    : 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300 hover:shadow-emerald-100/50'
              }`}
            >
              <div>
                {/* Contact Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                      {contact.contactName.slice(0, 2)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                        {contact.contactName}
                      </span>
                      <div className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <span>Lihat detail</span>
                        <ChevronRight className="w-2.5 h-2.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>

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

                {/* Balance Detail */}
                <div className="space-y-1.5 py-2 border-y border-slate-200/50 my-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                      Kita Nalangi:
                    </span>
                    <span className="font-semibold text-slate-700">
                      {formatRupiah(contact.totalOwedToUs)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" />
                      Kita Ditalangi:
                    </span>
                    <span className="font-semibold text-slate-700">
                      {formatRupiah(contact.totalWeOwe)}
                    </span>
                  </div>
                </div>

                {/* Net Balance */}
                <div className="mt-3">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Posisi Saldo Bersih:
                  </span>
                  <p
                    className={`text-lg font-black tracking-tight ${
                      isBalanced ? 'text-slate-500' : isWeOwe ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatRupiah(Math.abs(contact.netBalance))}
                  </p>
                </div>
              </div>

              {/* Action Button: Settle All Shortcut */}
              {!isBalanced && (
                <div className="mt-4 pt-3 border-t border-slate-200/50">
                  {isWeOwe ? (
                    <button
                      type="button"
                      onClick={(e) => handleSettle(e, contact.contactName, 'we_owe')}
                      disabled={isSubmitting}
                      className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs shadow-rose-200 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Lunasi Sekaligus ({formatRupiah(contact.totalWeOwe)})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleSettle(e, contact.contactName, 'owed_to_us')}
                      disabled={isSubmitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs shadow-emerald-200 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Tandai Lunas Sekaligus ({formatRupiah(contact.totalOwedToUs)})</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact Debt Items Detail Drawer */}
      <DebtDetailDrawer
        contact={currentSelected}
        isOpen={Boolean(currentSelected)}
        onClose={() => setSelectedContact(null)}
        onRefresh={onRefresh}
      />
    </div>
  );
};

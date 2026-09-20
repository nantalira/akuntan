import { ArrowRight, Lock } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

interface PasscodeModalProps {
  onAuthenticated: () => void;
}

export const PasscodeModal: React.FC<PasscodeModalProps> = ({ onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const savedPin = localStorage.getItem('akuntan_pin');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedPin) {
      if (pin.length >= 4) {
        localStorage.setItem('akuntan_pin', pin);
        onAuthenticated();
      } else {
        setError(true);
      }
    } else {
      if (pin === savedPin) {
        onAuthenticated();
      } else {
        setError(true);
        setPin('');
      }
    }
  };

  const handleSkip = () => {
    onAuthenticated();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-800 mb-1">
          {savedPin ? 'Kunci Keamanan' : 'Pasang PIN Pribadi'}
        </h2>
        <p className="text-slate-500 text-xs mb-6">
          {savedPin
            ? 'Masukkan 4 digit PIN untuk membuka catatan keuangan Anda.'
            : 'Buat 4 digit PIN untuk mengamankan catatan finansial Anda (atau lewati).'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="••••"
              autoFocus
              className={`w-full text-center text-3xl tracking-widest py-3 px-4 rounded-xl border bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                error
                  ? 'border-rose-400 focus:ring-rose-200 text-rose-600'
                  : 'border-slate-200 focus:ring-emerald-300'
              }`}
            />
          </div>

          {error && (
            <p className="text-xs text-rose-500 font-medium">
              {savedPin ? 'PIN salah, coba lagi.' : 'PIN minimal 4 digit angka.'}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-200"
          >
            <span>{savedPin ? 'Buka Kunci' : 'Simpan & Masuk'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {!savedPin && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 underline pt-2 block w-full"
            >
              Lewati (Tanpa PIN)
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

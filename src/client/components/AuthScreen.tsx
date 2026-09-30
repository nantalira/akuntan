import { AlertCircle, ArrowRight, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useState } from 'react';
import { api, setAuthToken } from '../api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  hasCustomGeminiKey: boolean;
  geminiApiKeyMasked: string | null;
  webhookToken: string;
  createdAt: string;
}

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.api.auth.login.$post({
          json: {
            email: email.trim(),
            password
          }
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(
            'error' in json && typeof json.error === 'string' ? json.error : 'Gagal masuk ke akun'
          );
        }
        setAuthToken(json.token);
        onAuthenticated(json.data as AuthUser);
      } else {
        const res = await api.api.auth.register.$post({
          json: {
            name: name.trim(),
            email: email.trim(),
            password
          }
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(
            'error' in json && typeof json.error === 'string'
              ? json.error
              : 'Gagal mendaftarkan akun'
          );
        }
        setAuthToken(json.token);
        onAuthenticated(json.data as AuthUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Header Brand */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-7 text-white text-center relative overflow-hidden">
          <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-white/20">
            <span className="text-2xl font-black tracking-tight">Rp</span>
          </div>
          <h1 className="text-xl font-black tracking-tight flex items-center justify-center gap-1.5">
            Akuntan AI
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-white/20 text-white">
              Multi-User
            </span>
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            Buku Kas Pribadi Terisolasi & Asisten Finansial Pintar
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="px-8 pt-6">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'register'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Lengkap / Panggilan
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-name"
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-bold text-slate-700 mb-1.5">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-bold text-slate-700 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-100 text-[11px] text-emerald-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-700">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Isolasi Data Otomatis & Aman</span>
              </div>
              <p className="text-emerald-700/90 leading-relaxed">
                Setiap akun memiliki buku kas, catatan hutang, kuota AI, dan token Webhook QRIS
                masing-masing yang terpisah secara privat.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all"
          >
            <span>
              {loading
                ? 'Memproses...'
                : mode === 'login'
                  ? 'Masuk ke Dashboard'
                  : 'Buat Akun & Masuk'}
            </span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Terproteksi enkripsi Web Crypto PBKDF2 & JWT Session</span>
          </div>
        </form>
      </div>
    </div>
  );
}

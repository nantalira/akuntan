import { KeyRound, LogOut, Save, Share2, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import type { AuthUser } from './AuthScreen';

interface ProfileModalProps {
  user: AuthUser;
  onClose: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
  onTransactionSimulated?: () => void;
}

export function ProfileModal({
  user,
  onClose,
  onUserUpdated,
  onLogout,
  onTransactionSimulated
}: ProfileModalProps) {
  const [name, setName] = useState(user.name);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [clearCustomKey, setClearCustomKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: { name?: string; geminiApiKey?: string | null } = {
        name: name.trim()
      };
      if (clearCustomKey) {
        payload.geminiApiKey = null;
      } else if (geminiApiKey.trim().length > 0) {
        payload.geminiApiKey = geminiApiKey.trim();
      }

      const res = await api.api.auth.profile.$put({
        json: payload
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error('Gagal menyimpan pengaturan profil');
      }

      onUserUpdated(json.data as AuthUser);
      setGeminiApiKey('');
      setClearCustomKey(false);
      setMessage({ type: 'success', text: 'Profil & pengaturan API Key berhasil diperbarui!' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan perubahan'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black text-base">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm">{user.name}</h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white/20">
                  User #{user.id}
                </span>
              </div>
              <p className="text-xs text-emerald-100">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {message && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold border ${
                message.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Panduan: Bagikan Bukti Bayar QRIS */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Share2 className="w-4 h-4 text-emerald-600" />
                <span>Panduan: Bagikan Bukti Bayar QRIS</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800">
                iOS & Android
              </span>
            </div>
            <p className="text-[11px] text-emerald-800/90 leading-relaxed">
              Setelah meng-install aplikasi ini ke layar utama HP (PWA / Android), setiap selesai
              bayar QRIS di <strong>myBCA, Livin Mandiri, BRImo, BNI, GoPay, DANA, atau OVO</strong>{' '}
              cukup klik tombol <strong>"Bagikan / Share"</strong> pada bukti bayar lalu pilih{' '}
              <strong>Akuntan AI</strong>!
            </p>
          </div>

          {/* Profile & BYOK Gemini Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label
                htmlFor="profile-name"
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
              >
                <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nama Tampilan</span>
              </label>
              <input
                id="profile-name"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="profile-gemini-key"
                  className="text-xs font-bold text-slate-800 flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Gemini API Key Pribadi (BYOK - Opsional)</span>
                </label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    user.hasCustomGeminiKey && !clearCustomKey
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {user.hasCustomGeminiKey && !clearCustomKey
                    ? `Aktif (${user.geminiApiKeyMasked})`
                    : 'Kuota Server Bersama'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Secara bawaan Anda mendapat jatah kuota AI harian gratis dari server. Anda juga bisa
                memasukkan API Key Gemini pribadi dari Google AI Studio agar kuota AI Anda tidak
                terbatas.
              </p>

              <input
                id="profile-gemini-key"
                type="password"
                value={geminiApiKey}
                onChange={(e) => {
                  setGeminiApiKey(e.target.value);
                  setClearCustomKey(false);
                }}
                placeholder={
                  user.hasCustomGeminiKey
                    ? 'Masukkan key baru untuk mengganti...'
                    : 'AIzaSy... (Kosongkan jika memakai kuota server)'
                }
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />

              {user.hasCustomGeminiKey && !clearCustomKey && (
                <button
                  type="button"
                  onClick={() => setClearCustomKey(true)}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Hapus API Key pribadi & kembali gunakan kuota server
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan Profil'}</span>
            </button>
          </form>

          {/* Footer Logout */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Data terisolasi untuk User #{user.id}</span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

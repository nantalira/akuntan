import {
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  RefreshCw,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  User as UserIcon,
  Webhook,
  X,
  Zap
} from 'lucide-react';
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

const SAMPLE_QRIS_NOTIFICATIONS = [
  {
    app: 'myBCA',
    title: 'Transaksi QRIS Berhasil',
    text: 'Pembayaran QRIS sebesar Rp 28.500 ke KOPI KENANGAN berhasil.'
  },
  {
    app: 'Livin by Mandiri',
    title: 'Livin by Mandiri',
    text: 'Berhasil bayar QRIS Rp 45.000 ke WARUNG SATE PAK BUDI pada tanggal hari ini.'
  },
  {
    app: 'GoPay',
    title: 'Pembayaran Berhasil',
    text: 'Kamu berhasil bayar Rp 18.000 via QRIS di INDOMARET POINT.'
  },
  {
    app: 'BRImo',
    title: 'Notifikasi BRImo',
    text: 'Pembayaran QRIS Rp 32.000 di MIE GACOAN PUSAT telah berhasil.'
  }
];

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
  const [regenerating, setRegenerating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const webhookUrl = `${window.location.origin}/api/webhooks/qris/${user.webhookToken}`;

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

  const handleRegenerateToken = async () => {
    setRegenerating(true);
    setMessage(null);
    try {
      const res = await api.api.auth['webhook-token'].regenerate.$post();
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error('Gagal memperbarui token webhook');
      }
      onUserUpdated(json.data as AuthUser);
      setMessage({
        type: 'success',
        text: 'Token Webhook QRIS baru berhasil dibuat!'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal memperbarui token'
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleSimulateQrisWebhook = async () => {
    setSimulating(true);
    setMessage(null);
    const sample = SAMPLE_QRIS_NOTIFICATIONS[sampleIndex % SAMPLE_QRIS_NOTIFICATIONS.length];
    setSampleIndex((prev) => prev + 1);

    try {
      const res = await fetch(`/api/webhooks/qris/${user.webhookToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: sample.app,
          title: sample.title,
          text: sample.text,
          referenceId: `SIM-${Date.now()}`
        })
      });

      const json = await res.json<{
        success: boolean;
        deduplicated?: boolean;
        engine?: string;
        data?: { name: string; amount: number; paymentMethod: string };
        error?: string;
        message?: string;
      }>();

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || json.message || 'Gagal menjalankan simulasi webhook QRIS');
      }

      onTransactionSimulated?.();
      if (json.deduplicated) {
        setMessage({
          type: 'success',
          text: `⚡ Anti-Dobel Aktif: "${json.data.name}" (Rp ${json.data.amount.toLocaleString('id-ID')} • ${json.data.paymentMethod}) sudah pernah tercatat.`
        });
      } else {
        setMessage({
          type: 'success',
          text: `⚡ Simulasi Berhasil! "${json.data.name}" (Rp ${json.data.amount.toLocaleString('id-ID')} • ${json.data.paymentMethod}) otomatis tercatat via ${json.engine === 'regex_0_quota' ? 'Mesin Regex (0 Kuota AI)' : 'Gemini AI'}.`
        });
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal mensimulasikan webhook QRIS'
      });
    } finally {
      setSimulating(false);
    }
  };

  const copyText = async (text: string, type: 'url' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      }
    } catch {
      // ignore clipboard errors
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

          {/* Cara 1: Zero-Setup PWA Share Target */}
          <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200/80 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                <Share2 className="w-4 h-4 text-sky-600" />
                <span>Cara 1 (Termudah): Klik "Bagikan" Bukti QRIS</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/70 text-sky-800">
                Tanpa Aplikasi Tambahan
              </span>
            </div>
            <p className="text-[11px] text-sky-800/90 leading-relaxed">
              Setelah meng-install web ini ke layar utama HP (PWA), setiap selesai bayar QRIS di{' '}
              <strong>myBCA, Livin Mandiri, BRImo, BNI, GoPay, DANA, atau OVO</strong> cukup klik
              tombol <strong>"Bagikan / Share"</strong> pada bukti bayar lalu pilih{' '}
              <strong>Akuntan AI</strong>!
            </p>
          </div>

          {/* Cara 2: Personal QRIS Webhook Section */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <Webhook className="w-4 h-4 text-emerald-600" />
                <span>Cara 2 (100% Otomatis): Personal QRIS Webhook</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Dual-Engine (0 Kuota)
              </span>
            </div>

            <p className="text-[11px] text-emerald-800/80 leading-relaxed">
              Ingin transaksi QRIS tercatat 100% otomatis di latar belakang begitu notifikasi bank
              muncul di HP? Gunakan URL unik Anda atau unduh template siap pakai di bawah ini.
            </p>

            {/* 1-Click Simulator Button */}
            <button
              type="button"
              onClick={handleSimulateQrisWebhook}
              disabled={simulating}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Zap className={`w-3.5 h-3.5 ${simulating ? 'animate-pulse' : ''}`} />
              <span>
                {simulating
                  ? 'Mengirim Simulasi Transaksi QRIS...'
                  : 'Uji Simulasi Transaksi QRIS Sekarang'}
              </span>
            </button>

            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Endpoint URL Pribadi Anda
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-[11px] font-mono text-slate-700 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyText(webhookUrl, 'url')}
                  className="px-3 py-2 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-1 transition-colors shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Disalin' : 'Salin'}</span>
                </button>
              </div>
            </div>

            {/* Template Google Sinkronisasi Otomatis (Gmail & Bank) */}
            <div className="p-3.5 rounded-2xl bg-white border border-emerald-200/90 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Template Google Sinkronisasi Otomatis</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Bebas Batas User
                </span>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Pilih salah satu cara di bawah ini untuk menduplikasi template ke Google Drive Anda.
                Skrip berjalan mandiri di akun Google Anda dan otomatis meneruskan email bukti QRIS
                ke Akuntan AI:
              </p>

              {/* Cara 1: Google Sheet Interaktif */}
              <a
                href="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/copy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between p-3 bg-emerald-50/50 hover:bg-emerald-100/60 border border-emerald-200/80 rounded-xl transition-all group"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-xs shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Cara 1: Google Sheet Interaktif</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-200 text-emerald-800">
                        Termudah
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Salin template Sheet ➔ Tempel Token di sel ➔ Klik tombol{' '}
                      <em>"🚀 Aktifkan Sinkronisasi"</em> di dalam sheet.
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-colors shrink-0 ml-2 mt-1" />
              </a>

              {/* Cara 2: Editor Script Langsung */}
              <a
                href="https://script.google.com/d/1akuntan_ai_gmail_sync_standalone/edit?copy=true"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between p-3 bg-sky-50/50 hover:bg-sky-100/60 border border-sky-200/80 rounded-xl transition-all group"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-sky-600 text-white shadow-xs shrink-0 mt-0.5">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Cara 2: Editor Script Langsung</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      Salin proyek Apps Script ➔ Tempel Token di baris atas ➔ Klik tombol{' '}
                      <em>"▷ Jalankan Setup"</em>.
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-sky-700 transition-colors shrink-0 ml-2 mt-1" />
              </a>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => copyText(user.webhookToken, 'token')}
                className="text-[11px] font-semibold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <span>
                  {copiedToken ? 'Token disalin!' : `Token: ${user.webhookToken.slice(0, 12)}...`}
                </span>
              </button>

              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={regenerating}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
                <span>Buat Ulang Token</span>
              </button>
            </div>
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

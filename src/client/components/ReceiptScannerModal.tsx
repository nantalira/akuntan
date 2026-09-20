import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  DollarSign,
  FileText,
  RefreshCw,
  Sparkles,
  Store,
  Tag,
  Upload,
  X
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReceiptExtractedData } from '../../server/routes/scanReceipt';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = ['Makan', 'Jajan', 'Primer', 'Motor', 'Olga', 'Belanja'] as const;

export function ReceiptScannerModal({ isOpen, onClose, onSuccess }: ReceiptScannerModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ReceiptExtractedData | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Belanja');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setImagePreview(null);
    setLoading(false);
    setError(null);
    setExtractedData(null);
    setMerchant('');
    setAmount('');
    setCategory('Belanja');
    setDate('');
    setNotes('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Compress image on canvas to max 1280px to ensure fast upload
  const processImageFile = async (file: File) => {
    setError(null);
    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawBase64 = e.target?.result as string;
        setImagePreview(rawBase64);

        // Compress using an offscreen image & canvas
        const img = new Image();
        img.src = rawBase64;
        img.onload = async () => {
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Gagal memproses canvas gambar');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

          // Call API
          try {
            const res = await fetch('/api/scan-receipt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: compressedBase64,
                mimeType: 'image/jpeg'
              })
            });

            const json = await res.json<{
              success: boolean;
              data?: ReceiptExtractedData;
              error?: string;
            }>();

            if (!json.success || !json.data) {
              throw new Error(json.error || 'Gagal membaca isi struk kasir');
            }

            const data = json.data;
            setExtractedData(data);
            setMerchant(data.merchant);
            setAmount(data.amount);
            setCategory(data.category);
            setDate(data.date);
            setNotes(data.notes);
          } catch (apiErr) {
            setError(apiErr instanceof Error ? apiErr.message : 'Koneksi ke Gemini Vision gagal');
          } finally {
            setLoading(false);
          }
        };
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membaca file gambar');
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant.trim()) {
      setError('Nama toko / keterangan tidak boleh kosong');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Nominal harus lebih dari 0');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: merchant.trim(),
          amount: numAmount,
          category,
          date: date || new Date().toISOString().split('T')[0],
          time: extractedData?.time || new Date().toTimeString().split(' ')[0],
          notes: notes.trim()
        })
      });

      const json = await res.json<{ success: boolean; error?: string }>();
      if (!json.success) {
        throw new Error(json.error || 'Gagal menyimpan transaksi');
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan transaksi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-sm">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base flex items-center gap-1.5">
                Scan Struk Kasir (OCR)
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  <Sparkles className="w-3 h-3" /> Gemini 3.8
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Pindai foto struk belanjaan fisik secara otomatis
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Hidden inputs for camera capture & gallery upload */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {!imagePreview && (
            <div className="py-6 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:bg-emerald-50/30 transition-colors">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-200 flex items-center justify-center text-emerald-600 mb-3">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Ambil Foto Struk Kasir</p>
              <p className="text-xs text-gray-400 text-center max-w-xs mb-5">
                Pastikan angka total belanja dan nama toko terlihat jelas dan tidak terlalu buram
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full px-8 max-w-sm">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm shadow-emerald-600/20 active:scale-[0.98] transition-all"
                >
                  <Camera className="w-4 h-4" /> Buka Kamera
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl active:scale-[0.98] transition-all"
                >
                  <Upload className="w-4 h-4 text-gray-500" /> Galeri File
                </button>
              </div>
            </div>
          )}

          {/* Loading Animation while Scanning */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="relative w-20 h-28 rounded-lg overflow-hidden border border-gray-200 shadow-md">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Struk Preview"
                    className="w-full h-full object-cover filter blur-[1px]"
                  />
                )}
                {/* Laser scan line */}
                <div className="absolute inset-x-0 h-1.5 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-bounce" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-gray-800 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                  Membaca struk kasir dengan AI...
                </p>
                <p className="text-xs text-gray-400">
                  Gemini sedang mengekstrak total belanja dan daftar barang
                </p>
              </div>
            </div>
          )}

          {/* Confirmation Form after OCR Extraction */}
          {extractedData && !loading && (
            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-800">
                    Struk Berhasil Dibaca!
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-emerald-700 border border-emerald-200">
                    Akurasi:{' '}
                    {extractedData.confidence === 'high'
                      ? 'Tinggi'
                      : extractedData.confidence === 'medium'
                        ? 'Sedang'
                        : 'Rendah'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Foto Ulang
                </button>
              </div>

              {/* Form Input: Merchant / Toko */}
              <div className="space-y-1.5">
                <label
                  htmlFor="receipt-merchant"
                  className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5 text-gray-400" /> Nama Toko / Keterangan
                </label>
                <input
                  id="receipt-merchant"
                  type="text"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Contoh: Indomaret, Kopi Kenangan"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              {/* Form Input: Nominal & Kategori */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="receipt-amount"
                    className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-gray-400" /> Total Belanja (Rp)
                  </label>
                  <input
                    id="receipt-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    min="1"
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="receipt-category"
                    className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> Kategori
                  </label>
                  <select
                    id="receipt-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Form Input: Tanggal */}
              <div className="space-y-1.5">
                <label
                  htmlFor="receipt-date"
                  className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400" /> Tanggal Transaksi
                </label>
                <input
                  id="receipt-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              {/* Form Input: Rincian Barang / Notes */}
              <div className="space-y-1.5">
                <label
                  htmlFor="receipt-notes"
                  className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-400" /> Rincian Item Belanjaan
                </label>
                <textarea
                  id="receipt-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Rincian barang kasir..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-medium text-sm rounded-xl shadow-sm shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Simpan Transaksi'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

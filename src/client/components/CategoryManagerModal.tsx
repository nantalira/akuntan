import { AlertCircle, Check, Palette, Pencil, Plus, Trash2, X } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { type UserCategory, useCategories } from '../hooks/useCategories';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated?: () => void;
}

const PRESET_EMOJIS = [
  '🍜',
  '☕',
  '🛒',
  '⛽',
  '🏸',
  '🛍️',
  '🏠',
  '💊',
  '🎮',
  '📚',
  '🐾',
  '✈️',
  '💡',
  '👶',
  '🍕',
  '🚗',
  '🎬',
  '👗'
];

const PRESET_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#ef4444', // red
  '#06b6d4' // cyan
];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesUpdated
}) => {
  const { categories, isLoading, addCategory, updateCategory, deleteCategory } = useCategories();

  const [isAdding, setIsAdding] = useState(false);
  const [editingCat, setEditingCat] = useState<UserCategory | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💰');
  const [color, setColor] = useState('#10b981');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [deletingCat, setDeletingCat] = useState<UserCategory | null>(null);

  if (!isOpen) return null;

  const startAdd = () => {
    setEditingCat(null);
    setName('');
    setEmoji('💰');
    setColor(PRESET_COLORS[categories.length % PRESET_COLORS.length] || '#10b981');
    setFormError(null);
    setIsAdding(true);
  };

  const startEdit = (cat: UserCategory) => {
    setIsAdding(false);
    setEditingCat(cat);
    setName(cat.name);
    setEmoji(cat.emoji);
    setColor(cat.color);
    setFormError(null);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingCat(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Nama kategori wajib diisi');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingCat) {
        const res = await updateCategory(editingCat.id, {
          name: name.trim(),
          emoji: emoji.trim() || '💰',
          color
        });
        if (!res.success) {
          setFormError(res.error || 'Gagal memperbarui kategori');
          return;
        }
      } else {
        const res = await addCategory({
          name: name.trim(),
          emoji: emoji.trim() || '💰',
          color
        });
        if (!res.success) {
          setFormError(res.error || 'Gagal menambahkan kategori');
          return;
        }
      }

      cancelForm();
      onCategoriesUpdated?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCat) return;
    setIsSubmitting(true);
    try {
      const res = await deleteCategory(deletingCat.id);
      if (res.success) {
        setDeletingCat(null);
        onCategoriesUpdated?.();
      } else {
        setFormError(res.error || 'Gagal menghapus kategori');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏷️</span>
            <div>
              <h3 className="text-lg font-bold">Kelola Kategori</h3>
              <p className="text-xs text-emerald-100">{categories.length}/8 Kategori Aktif</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Create / Edit */}
          {(isAdding || editingCat) && (
            <form
              onSubmit={handleSubmit}
              className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {editingCat ? 'Edit Kategori' : 'Kategori Baru'}
                </span>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Batal
                </button>
              </div>

              {/* Name & Emoji input */}
              <div className="grid grid-cols-[60px_1fr] gap-2.5">
                <div>
                  <label
                    htmlFor="cat-emoji-input"
                    className="block text-[11px] font-semibold text-slate-500 mb-1"
                  >
                    Emoji
                  </label>
                  <input
                    id="cat-emoji-input"
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-full h-11 text-center text-xl bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label
                    htmlFor="cat-name-input"
                    className="block text-[11px] font-semibold text-slate-500 mb-1"
                  >
                    Nama Kategori
                  </label>
                  <input
                    id="cat-name-input"
                    type="text"
                    placeholder="Contoh: Kos, Pulsa, Kopi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={25}
                    className="w-full h-11 px-3 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Preset Emojis */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
                  Pilih Emoji Cepat
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white border border-slate-200 rounded-xl">
                  {PRESET_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                        emoji === em
                          ? 'bg-emerald-100 ring-2 ring-emerald-500 scale-110'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preset Colors */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" /> Pilihan Warna
                </span>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setColor(col)}
                      style={{ backgroundColor: col }}
                      className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                        color === col
                          ? 'scale-125 ring-2 ring-offset-2 ring-slate-400'
                          : 'hover:scale-110'
                      }`}
                    >
                      {color === col && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {isSubmitting
                    ? 'Menyimpan...'
                    : editingCat
                      ? 'Perbarui Kategori'
                      : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          )}

          {/* Category List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-semibold">
              <span>Daftar Kategori ({categories.length}/8)</span>
              {!isAdding && !editingCat && categories.length < 8 && (
                <button
                  type="button"
                  onClick={startAdd}
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Pos
                </button>
              )}
            </div>

            {isLoading && categories.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Memuat kategori...</div>
            ) : categories.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Belum ada kategori</div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm"
                        style={{
                          backgroundColor: `${cat.color}20`,
                          border: `1.5px solid ${cat.color}`
                        }}
                      >
                        {cat.emoji}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                          {cat.name}
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: cat.color }}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400">Pos Pengeluaran</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                        title="Edit Kategori"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {categories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDeletingCat(cat)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal / Backdrop */}
        {deletingCat && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-10 animate-fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-100 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl">
                ⚠️
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                Hapus Kategori {deletingCat.emoji} {deletingCat.name}?
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Kategori ini akan disembunyikan. Riwayat transaksi masa lalu yang menggunakan
                kategori ini tetap tersimpan aman.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDeletingCat(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors"
                >
                  {isSubmitting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

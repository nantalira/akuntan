import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export interface UserCategory {
  id: number;
  userId: number;
  name: string;
  emoji: string;
  color: string;
  sortOrder: number;
  isActive: number;
  createdAt: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.api.categories.$get();
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCategories(json.data as UserCategory[]);
        }
      } else {
        setError('Gagal memuat kategori');
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Koneksi terputus saat mengambil kategori');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addCategory = useCallback(
    async (payload: { name: string; emoji?: string; color?: string }) => {
      setError(null);
      try {
        const res = await api.api.categories.$post({
          json: {
            name: payload.name,
            emoji: payload.emoji || '💰',
            color: payload.color || '#10b981'
          }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          await fetchCategories();
          return { success: true, data: json.data };
        }
        const errorMsg =
          'error' in json && typeof json.error === 'string'
            ? json.error
            : 'Gagal menambahkan kategori';
        return { success: false, error: errorMsg };
      } catch (err) {
        console.error('Error adding category:', err);
        return { success: false, error: 'Terjadi kesalahan sistem' };
      }
    },
    [fetchCategories]
  );

  const updateCategory = useCallback(
    async (
      id: number,
      payload: { name?: string; emoji?: string; color?: string; sortOrder?: number }
    ) => {
      setError(null);
      try {
        const res = await api.api.categories[':id'].$put({
          param: { id: String(id) },
          json: payload
        });
        const json = await res.json();
        if (res.ok && json.success) {
          await fetchCategories();
          return { success: true, data: json.data };
        }
        const errorMsg =
          'error' in json && typeof json.error === 'string'
            ? json.error
            : 'Gagal memperbarui kategori';
        return { success: false, error: errorMsg };
      } catch (err) {
        console.error('Error updating category:', err);
        return { success: false, error: 'Terjadi kesalahan sistem' };
      }
    },
    [fetchCategories]
  );

  const deleteCategory = useCallback(
    async (id: number) => {
      setError(null);
      try {
        const res = await api.api.categories[':id'].$delete({
          param: { id: String(id) }
        });
        const json = await res.json();
        if (res.ok && json.success) {
          await fetchCategories();
          return { success: true };
        }
        const errorMsg =
          'error' in json && typeof json.error === 'string'
            ? json.error
            : 'Gagal menghapus kategori';
        return { success: false, error: errorMsg };
      } catch (err) {
        console.error('Error deleting category:', err);
        return { success: false, error: 'Terjadi kesalahan sistem' };
      }
    },
    [fetchCategories]
  );

  const getCategoryEmoji = useCallback(
    (categoryName: string): string => {
      const found = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (found) return found.emoji;
      // Default fallbacks for legacy/common names
      const lower = categoryName.toLowerCase();
      if (lower.includes('makan')) return '🍜';
      if (lower.includes('jajan') || lower.includes('kopi')) return '☕';
      if (lower.includes('primer') || lower.includes('listrik') || lower.includes('kos'))
        return '🛒';
      if (lower.includes('transport') || lower.includes('motor') || lower.includes('bensin'))
        return '⛽';
      if (lower.includes('olga') || lower.includes('sport') || lower.includes('gym')) return '🏸';
      if (lower.includes('belanja')) return '🛍️';
      return '💰';
    },
    [categories]
  );

  const getCategoryColor = useCallback(
    (categoryName: string): string => {
      const found = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (found) return found.color;
      const lower = categoryName.toLowerCase();
      if (lower.includes('makan')) return '#10b981';
      if (lower.includes('jajan')) return '#f59e0b';
      if (lower.includes('primer')) return '#3b82f6';
      if (lower.includes('transport') || lower.includes('motor')) return '#6366f1';
      if (lower.includes('olga')) return '#ec4899';
      if (lower.includes('belanja')) return '#8b5cf6';
      return '#64748b';
    },
    [categories]
  );

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    isLoading,
    error,
    refetch: fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryEmoji,
    getCategoryColor
  };
}

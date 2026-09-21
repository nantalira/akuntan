import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export interface AiQuotaData {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  model: string;
  status: 'safe' | 'warning' | 'exceeded';
}

export function useAiQuota() {
  const [quota, setQuota] = useState<AiQuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuota = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.api['ai-quota'].$get();
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQuota({
            date: data.date,
            used: data.used,
            limit: data.limit,
            remaining: data.remaining,
            model: data.model,
            status: data.status
          });
        }
      } else {
        setError('Gagal memuat status kuota AI');
      }
    } catch (err) {
      console.error('Error fetching AI quota:', err);
      setError('Koneksi terputus saat mengecek kuota');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return {
    quota,
    isLoading,
    error,
    refetch: fetchQuota
  };
}

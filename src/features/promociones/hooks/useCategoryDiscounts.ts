'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CategoryDiscountCampaign } from '../types/descuento.types';
import { getCategoryDiscounts } from '../services/descuentos.service';

export function useCategoryDiscounts() {
  const [campaigns, setCampaigns] = useState<CategoryDiscountCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getCategoryDiscounts();
      setCampaigns(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las campañas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onVisible = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return { campaigns, loading, error, refresh };
}

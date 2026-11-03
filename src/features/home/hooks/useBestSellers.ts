'use client';

import { useEffect, useState } from 'react';
import { getPublicBestSellers, type BestSellerRank } from '../services/best-sellers.service';

export function useBestSellers() {
  const [ranking, setRanking] = useState<BestSellerRank[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getPublicBestSellers()
      .then(data => { if (mounted) setRanking(data); })
      .catch(() => { if (mounted) setError('No pudimos consultar los más vendidos.'); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  return { ranking, isLoading, error };
}

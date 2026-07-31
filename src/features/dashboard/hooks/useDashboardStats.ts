'use client';

import { useEffect, useState } from 'react';
import type { DashboardStats } from '../types/dashboard.types';
import { getDashboardStats } from '../services/dashboard.service';
import { subscribeToOrders } from '@/features/pedidos/services/pedidos.service';

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setIsLoading(true);
      setError(null);
      setStats(await getDashboardStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
    return subscribeToOrders(load);
  }, []);

  return { stats, isLoading, error, refresh: load };
}

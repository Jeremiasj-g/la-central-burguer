'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Order, OrderFilters } from '../types/pedido.types';
import { getPedidos, subscribeToOrders } from '../services/pedidos.service';

export function usePedidos(filters: OrderFilters = {}) {
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const loadPedidos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setPedidos(await getPedidos(JSON.parse(filtersKey) as OrderFilters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos');
    } finally {
      setIsLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    loadPedidos();
    return subscribeToOrders(loadPedidos);
  }, [loadPedidos]);

  return { pedidos, isLoading, error, refresh: loadPedidos };
}

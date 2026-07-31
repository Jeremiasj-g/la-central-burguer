'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product, ProductFilters } from '../types/producto.types';
import { getProductos, subscribeToProducts } from '../services/productos.service';

export function useProductos(filters: ProductFilters = {}) {
  const [productos, setProductos] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const loadProductos = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProductos(JSON.parse(filtersKey) as ProductFilters);
      setProductos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
    } finally {
      setIsLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    loadProductos();
    return subscribeToProducts(loadProductos);
  }, [loadProductos]);

  return { productos, isLoading, error, refresh: loadProductos };
}

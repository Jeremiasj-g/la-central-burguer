'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, CategoryFilters } from '../types/categoria.types';
import { getCategorias, subscribeToCategories } from '../services/categorias.service';

export function useCategorias(filters: CategoryFilters = {}) {
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const loadCategorias = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCategorias(await getCategorias(JSON.parse(filtersKey) as CategoryFilters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar categorías');
    } finally {
      setIsLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    loadCategorias();
    return subscribeToCategories(loadCategorias);
  }, [loadCategorias]);

  return { categorias, isLoading, error, refresh: loadCategorias };
}

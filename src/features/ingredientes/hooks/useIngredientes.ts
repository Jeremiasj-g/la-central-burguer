'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Ingredient, IngredientFilters } from '../types/ingrediente.types';
import { getIngredientes, subscribeToIngredients } from '../services/ingredientes.service';

export function useIngredientes(filters: IngredientFilters = {}) {
  const [ingredientes, setIngredientes] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const loadIngredientes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIngredientes(await getIngredientes(JSON.parse(filtersKey) as IngredientFilters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ingredientes');
    } finally {
      setIsLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    loadIngredientes();
    return subscribeToIngredients(loadIngredientes);
  }, [loadIngredientes]);

  return { ingredientes, isLoading, error, refresh: loadIngredientes };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProductRecipe } from '../types/receta.types';
import { getRecetas, subscribeToRecipes } from '../services/recetas.service';

export function useRecetas() {
  const [recetas, setRecetas] = useState<ProductRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setRecetas(await getRecetas());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las recetas.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeToRecipes(() => void refresh());
  }, [refresh]);

  return { recetas, isLoading, error, refresh };
}

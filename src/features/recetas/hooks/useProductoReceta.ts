'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProductRecipe } from '../types/receta.types';
import { getRecetaByProductoId } from '../services/recetas.service';

export function useProductoReceta(productId?: string) {
  const [recipe, setRecipe] = useState<ProductRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!productId) {
      setRecipe(null);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setRecipe(await getRecetaByProductoId(productId));
    } catch (err) {
      setRecipe(null);
      setError(err instanceof Error ? err.message : 'No se pudo cargar la composición.');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { recipe, isLoading, error, refresh };
}

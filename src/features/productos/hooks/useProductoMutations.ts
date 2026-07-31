'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { CreateProductInput, UpdateProductInput } from '../types/producto.types';
import { createProducto, deleteProducto, toggleProductoActive, toggleProductoAvailable, toggleProductoFeatured, updateProducto } from '../services/productos.service';

export function useProductoMutations(onSuccess?: () => void) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(action: () => Promise<T>, successMessage: string) {
    try {
      setIsSaving(true);
      setError(null);
      const result = await action();
      onSuccess?.();
      toast.success(successMessage);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar la acción.';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isSaving,
    error,
    create: (input: CreateProductInput) => run(() => createProducto(input), 'Producto creado correctamente.'),
    update: (input: UpdateProductInput) => run(() => updateProducto(input), 'Producto actualizado correctamente.'),
    remove: (id: string) => run(() => deleteProducto(id), 'Producto eliminado correctamente.'),
    toggleActive: (id: string) => run(() => toggleProductoActive(id), 'Estado del producto actualizado.'),
    toggleAvailable: (id: string) => run(() => toggleProductoAvailable(id), 'Disponibilidad actualizada.'),
    toggleFeatured: (id: string) => run(() => toggleProductoFeatured(id), 'Producto destacado actualizado.'),
  };
}

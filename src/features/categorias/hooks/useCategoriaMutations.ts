'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { CreateCategoryInput, UpdateCategoryInput } from '../types/categoria.types';
import { createCategoria, deleteCategoria, toggleCategoriaActive, updateCategoria } from '../services/categorias.service';

export function useCategoriaMutations(onSuccess?: () => void) {
  const [isSaving, setIsSaving] = useState(false);

  async function run<T>(action: () => Promise<T>, successMessage: string) {
    setIsSaving(true);
    try {
      const result = await action();
      onSuccess?.();
      toast.success(successMessage);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo completar la acción.';
      toast.error(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isSaving,
    create: (input: CreateCategoryInput) => run(() => createCategoria(input), 'Categoría creada correctamente.'),
    update: (input: UpdateCategoryInput) => run(() => updateCategoria(input), 'Categoría actualizada correctamente.'),
    remove: (id: string) => run(() => deleteCategoria(id), 'Categoría eliminada correctamente.'),
    toggleActive: (id: string) => run(() => toggleCategoriaActive(id), 'Estado de categoría actualizado.'),
  };
}

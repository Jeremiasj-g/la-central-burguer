'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import type { CreateIngredientInput, UpdateIngredientInput } from '../types/ingrediente.types';
import { createIngrediente, deleteIngrediente, toggleIngredienteActive, updateIngrediente } from '../services/ingredientes.service';

export function useIngredienteMutations(onSuccess?: () => void) {
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
    create: (input: CreateIngredientInput) => run(() => createIngrediente(input), 'Ingrediente creado correctamente.'),
    update: (input: UpdateIngredientInput) => run(() => updateIngrediente(input), 'Ingrediente actualizado correctamente.'),
    remove: (id: string) => run(() => deleteIngrediente(id), 'Ingrediente eliminado correctamente.'),
    toggleActive: (id: string) => run(() => toggleIngredienteActive(id), 'Estado de ingrediente actualizado.'),
  };
}

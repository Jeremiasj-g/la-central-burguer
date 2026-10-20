import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { IngredientUnit } from '../types/ingrediente.types';

export type IngredientCostHistory = {
  id: number;
  ingredient_id: string;
  ingredient_name: string;
  supplier: string | null;
  previous_unit_cost: number | null;
  new_unit_cost: number;
  previous_unit: IngredientUnit | null;
  unit: IngredientUnit;
  change_type: 'baseline' | 'initial' | 'updated';
  recorded_at: string;
};

export async function getIngredientCostHistory(ingredientId: string): Promise<IngredientCostHistory[]> {
  requireSupabaseConfigured('consultar el historial de costos');

  // El historial se registra mediante un trigger de Supabase, no desde el navegador.
  // RLS permite ver los eventos únicamente a administradores autenticados.
  const { data, error } = await getSupabaseBrowserClient()
    .from('ingredient_cost_history')
    .select('id,ingredient_id,ingredient_name,supplier,previous_unit_cost,new_unit_cost,previous_unit,unit,change_type,recorded_at')
    .eq('ingredient_id', ingredientId)
    .order('recorded_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as IngredientCostHistory[];
}

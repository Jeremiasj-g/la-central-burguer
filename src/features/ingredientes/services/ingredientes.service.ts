import type {
  CreateIngredientInput,
  Ingredient,
  IngredientFilters,
  IngredientRow,
  UpdateIngredientInput,
} from '../types/ingrediente.types';
import { mapIngredientRowToIngredient } from '../mappers/ingrediente.mapper';
import { isSupabaseConfigured, requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';

export async function getIngredientes(filters: IngredientFilters = {}): Promise<Ingredient[]> {
  requireSupabaseConfigured('consultar los ingredientes');

  let query = getSupabaseBrowserClient()
    .from('ingredients')
    .select('*')
    .is('deleted_at', null)
    .order('name');

  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.active === 'active') query = query.eq('active', true);
  if (filters.active === 'inactive') query = query.eq('active', false);
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,supplier.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as IngredientRow[]).map(mapIngredientRowToIngredient);
}

export async function createIngrediente(input: CreateIngredientInput): Promise<Ingredient> {
  requireSupabaseConfigured('crear ingredientes');

  const { data, error } = await getSupabaseBrowserClient()
    .from('ingredients')
    .insert({
      name: input.name,
      type: input.type,
      unit: input.unit,
      supplier: input.supplier || null,
      active: input.active ?? true,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapIngredientRowToIngredient(data as IngredientRow);
}

export async function updateIngrediente(input: UpdateIngredientInput): Promise<Ingredient> {
  requireSupabaseConfigured('editar ingredientes');

  const payload = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    ...(input.supplier !== undefined ? { supplier: input.supplier || null } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    last_updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabaseBrowserClient()
    .from('ingredients')
    .update(payload)
    .eq('id', input.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapIngredientRowToIngredient(data as IngredientRow);
}

export async function deleteIngrediente(id: string): Promise<void> {
  requireSupabaseConfigured('eliminar ingredientes');

  const { count, error: linkError } = await getSupabaseBrowserClient()
    .from('product_ingredients')
    .select('id', { count: 'exact', head: true })
    .eq('ingredient_id', id);

  if (linkError) throw new Error(linkError.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      'El ingrediente está asociado a productos. Quitalo de esos productos o desactivalo.',
    );
  }

  const { error } = await getSupabaseBrowserClient()
    .from('ingredients')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function toggleIngredienteActive(id: string): Promise<Ingredient> {
  const ingredient = (await getIngredientes({ active: 'all' })).find((item) => item.id === id);
  if (!ingredient) throw new Error('Ingrediente no encontrado');
  return updateIngrediente({ id, active: !ingredient.active });
}

const subscribeIngredientsRealtime = createSharedRealtimeSubscription(
  'catalog-ingredients',
  (channel, notifyListeners) =>
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ingredients' },
      notifyListeners,
    ),
);

export function subscribeToIngredients(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  return subscribeIngredientsRealtime(onChange);
}

import type {
  Category,
  CategoryFilters,
  CategoryRow,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../types/categoria.types';
import { mapCategoryRowToCategory } from '../mappers/categoria.mapper';
import { isSupabaseConfigured, requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';

export async function getCategorias(filters: CategoryFilters = {}): Promise<Category[]> {
  requireSupabaseConfigured('consultar las categorías');

  let query = getSupabaseBrowserClient()
    .from('categories')
    .select('*')
    .is('deleted_at', null)
    .order('display_order', { ascending: true });

  if (filters.active === 'active') query = query.eq('active', true);
  if (filters.active === 'inactive') query = query.eq('active', false);
  if (filters.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as CategoryRow[]).map(mapCategoryRowToCategory);
}

export async function createCategoria(input: CreateCategoryInput): Promise<Category> {
  requireSupabaseConfigured('crear categorías');

  const { data, error } = await getSupabaseBrowserClient()
    .from('categories')
    .insert({
      name: input.name,
      description: input.description ?? null,
      icon_name: input.iconName ?? null,
      image_url: input.imageUrl ?? null,
      display_order: input.order ?? 0,
      active: input.active ?? true,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapCategoryRowToCategory(data as CategoryRow);
}

export async function updateCategoria(input: UpdateCategoryInput): Promise<Category> {
  requireSupabaseConfigured('editar categorías');

  const payload = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.iconName !== undefined ? { icon_name: input.iconName || null } : {}),
    ...(input.imageUrl !== undefined ? { image_url: input.imageUrl || null } : {}),
    ...(input.order !== undefined ? { display_order: input.order } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };

  const { data, error } = await getSupabaseBrowserClient()
    .from('categories')
    .update(payload)
    .eq('id', input.id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapCategoryRowToCategory(data as CategoryRow);
}

export async function deleteCategoria(id: string): Promise<void> {
  requireSupabaseConfigured('eliminar categorías');

  const { count, error: productError } = await getSupabaseBrowserClient()
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
    .is('deleted_at', null);

  if (productError) throw new Error(productError.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      'La categoría tiene productos asociados. Desactivala o mové sus productos antes de eliminarla.',
    );
  }

  const { error } = await getSupabaseBrowserClient()
    .from('categories')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function toggleCategoriaActive(id: string): Promise<Category> {
  const category = (await getCategorias({ active: 'all' })).find((item) => item.id === id);
  if (!category) throw new Error('Categoría no encontrada');
  return updateCategoria({ id, active: !category.active });
}

const subscribeCategoriesRealtime = createSharedRealtimeSubscription(
  'catalog-categories',
  (channel, notifyListeners) =>
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories' },
      notifyListeners,
    ),
);

export function subscribeToCategories(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  return subscribeCategoriesRealtime(onChange);
}

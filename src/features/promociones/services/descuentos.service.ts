import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { CategoryDiscountCampaign, CategoryDiscountInput } from '../types/descuento.types';

const table = () => getSupabaseBrowserClient().from('category_discount_campaigns');

export async function getCategoryDiscounts(): Promise<CategoryDiscountCampaign[]> {
  requireSupabaseConfigured('consultar las campañas de descuento');
  const { data, error } = await table().select('*').order('starts_on', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryDiscountCampaign[];
}

export async function saveCategoryDiscount(input: CategoryDiscountInput, id?: string): Promise<void> {
  requireSupabaseConfigured('guardar la campaña');
  const title = input.title.trim();
  if (title.length < 3) throw new Error('Indicá un nombre de al menos tres caracteres.');
  if (!input.category_ids.length) throw new Error('Seleccioná al menos una categoría.');
  if (!Number.isFinite(input.discount_percent) || input.discount_percent <= 0 || input.discount_percent >= 100)
    throw new Error('El descuento debe ser mayor a 0% y menor a 100%.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.starts_on) || !/^\d{4}-\d{2}-\d{2}$/.test(input.ends_on) || input.ends_on < input.starts_on)
    throw new Error('El fin debe ser igual o posterior al inicio.');
  const payload = { ...input, title, updated_at: new Date().toISOString() };
  const query = id ? table().update(payload).eq('id', id) : table().insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function setCategoryDiscountEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await table().update({ enabled, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function removeCategoryDiscount(id: string): Promise<void> {
  const { error } = await table().delete().eq('id', id);
  if (error) throw new Error(error.message);
}

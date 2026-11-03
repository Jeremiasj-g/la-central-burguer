import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';

export interface BestSellerRank {
  productId: string;
  unitsSold: number;
}

/** Solo devuelve agregados de pedidos no cancelados, sin información de clientes. */
export async function getPublicBestSellers(): Promise<BestSellerRank[]> {
  requireSupabaseConfigured('consultar los productos más vendidos');
  const { data, error } = await getSupabaseBrowserClient().rpc('get_public_best_sellers');
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => ({
    productId: row.product_id,
    unitsSold: Number(row.units_sold),
  }));
}

import type { SaleFilters, SaleLedgerEntry } from '../types/venta.types';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type SaleRow = Database['public']['Views']['sales_ledger']['Row'];

function mapRow(row: SaleRow): SaleLedgerEntry {
  return {
    id: row.id,
    orderCode: row.order_code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    deliveryCost: Number(row.delivery_cost),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSales(filters: SaleFilters = {}): Promise<SaleLedgerEntry[]> {
  requireSupabaseConfigured('consultar el registro de ventas');

  let query = getSupabaseBrowserClient()
    .from('sales_ledger')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.deliveryMethod && filters.deliveryMethod !== 'all') {
    query = query.eq('delivery_method', filters.deliveryMethod);
  }

  if (filters.paymentMethod && filters.paymentMethod !== 'all') {
    query = query.eq('payment_method', filters.paymentMethod);
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(`order_code.ilike.%${search}%,customer_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as SaleRow[]).map(mapRow);
}

import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import type {
  ReportDataset,
  ReportFilters,
  ReportItem,
  ReportOrder,
} from '../types/reporte.types';

const PAGE_SIZE = 1000;
const ITEM_ID_CHUNK_SIZE = 180;

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

function toStartIso(dateInput: string) {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function toEndIso(dateInput: string) {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function mapOrder(row: OrderRow): ReportOrder {
  return {
    id: row.id,
    orderCode: row.order_code,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryMethod: row.delivery_method,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    deliveryCost: Number(row.delivery_cost),
    total: Number(row.total),
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapItem(row: OrderItemRow): ReportItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    categoryId: row.category_id,
    productName: row.product_name,
    categoryName: row.category_name,
    isPromotion: row.is_promotion,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
  };
}

function applySearch(rows: ReportOrder[], search: string) {
  const term = search.trim().toLocaleLowerCase('es-AR');
  if (!term) return rows;

  return rows.filter((order) =>
    [order.orderCode, order.customerName, order.customerPhone]
      .some((value) => value.toLocaleLowerCase('es-AR').includes(term)),
  );
}

async function fetchOrders(filters: ReportFilters): Promise<ReportOrder[]> {
  const supabase = getSupabaseBrowserClient();
  const rows: OrderRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!filters.allTime) {
      query = query
        .gte('created_at', toStartIso(filters.from))
        .lte('created_at', toEndIso(filters.to));
    }

    if (filters.status === 'valid') query = query.neq('status', 'cancelado');
    if (filters.status === 'aceptado') query = query.eq('status', 'aceptado');
    if (filters.status === 'cancelado') query = query.eq('status', 'cancelado');
    if (filters.paymentMethod !== 'all') query = query.eq('payment_method', filters.paymentMethod);
    if (filters.deliveryMethod !== 'all') query = query.eq('delivery_method', filters.deliveryMethod);

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const page = (data ?? []) as OrderRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return applySearch(rows.map(mapOrder), filters.search);
}

async function fetchItems(orderIds: string[]): Promise<ReportItem[]> {
  if (!orderIds.length) return [];

  const supabase = getSupabaseBrowserClient();
  const rows: OrderItemRow[] = [];

  for (let index = 0; index < orderIds.length; index += ITEM_ID_CHUNK_SIZE) {
    const chunk = orderIds.slice(index, index + ITEM_ID_CHUNK_SIZE);
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', chunk)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw new Error(error.message);

      const page = (data ?? []) as OrderItemRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }

  return rows.map(mapItem);
}

export async function getReportData(filters: ReportFilters): Promise<ReportDataset> {
  requireSupabaseConfigured('generar reportes');

  if (!filters.allTime && (!filters.from || !filters.to)) {
    throw new Error('Seleccioná un período válido para generar el reporte.');
  }

  if (!filters.allTime && filters.from > filters.to) {
    throw new Error('La fecha desde no puede ser posterior a la fecha hasta.');
  }

  const orders = await fetchOrders(filters);
  const items = await fetchItems(orders.map((order) => order.id));

  return { orders, items };
}

import type { Order, OrderFilters, OrderStatus } from '../types/pedido.types';
import { mapHistoryRow, mapOrderItemRow, mapOrderRow } from '../mappers/pedido.mapper';
import { isSupabaseConfigured, requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';
import type { Database, Json } from '@/lib/supabase/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type HistoryRow = Database['public']['Tables']['order_status_history']['Row'];

async function hydrateOrders(rows: OrderRow[]): Promise<Order[]> {
  if (!rows.length) return [];

  const ids = rows.map((row) => row.id);
  const supabase = getSupabaseBrowserClient();
  const [
    { data: itemData, error: itemError },
    { data: historyData, error: historyError },
  ] = await Promise.all([
    supabase.from('order_items').select('*').in('order_id', ids).order('created_at'),
    supabase.from('order_status_history').select('*').in('order_id', ids).order('created_at'),
  ]);

  if (itemError) throw new Error(itemError.message);
  if (historyError) throw new Error(historyError.message);

  const itemsByOrder = new Map<string, ReturnType<typeof mapOrderItemRow>[]>();
  for (const row of (itemData ?? []) as OrderItemRow[]) {
    itemsByOrder.set(row.order_id, [
      ...(itemsByOrder.get(row.order_id) ?? []),
      mapOrderItemRow(row),
    ]);
  }

  const historyByOrder = new Map<string, ReturnType<typeof mapHistoryRow>[]>();
  for (const row of (historyData ?? []) as HistoryRow[]) {
    historyByOrder.set(row.order_id, [
      ...(historyByOrder.get(row.order_id) ?? []),
      mapHistoryRow(row),
    ]);
  }

  return rows.map((row) => mapOrderRow(
    row,
    itemsByOrder.get(row.id) ?? [],
    historyByOrder.get(row.id) ?? [],
  ));
}

export async function getPedidos(filters: OrderFilters = {}): Promise<Order[]> {
  requireSupabaseConfigured('consultar los pedidos');

  let query = getSupabaseBrowserClient()
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim();
    query = query.or(
      `order_code.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return hydrateOrders((data ?? []) as OrderRow[]);
}

export async function getPedidoByCode(code: string): Promise<Order | null> {
  requireSupabaseConfigured('buscar un pedido');

  const { data, error } = await getSupabaseBrowserClient()
    .from('orders')
    .select('*')
    .ilike('order_code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return (await hydrateOrders([data as OrderRow]))[0] ?? null;
}

export async function createPublicPedido(payload: Json): Promise<Order> {
  requireSupabaseConfigured('confirmar el pedido');

  const { data, error } = await getSupabaseBrowserClient().rpc('create_public_order', { payload });
  if (error) throw new Error(error.message);

  return data as unknown as Order;
}

export async function updatePedidoStatus(id: string, status: OrderStatus): Promise<Order> {
  requireSupabaseConfigured('actualizar el estado del pedido');

  const { data, error } = await getSupabaseBrowserClient()
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const updated = (await hydrateOrders([data as OrderRow]))[0];
  if (!updated) throw new Error('No se pudo recuperar el pedido actualizado.');
  return updated;
}

export function cancelPedido(id: string) {
  return updatePedidoStatus(id, 'cancelado');
}

const subscribeOrdersRealtime = createSharedRealtimeSubscription(
  'admin-orders',
  (channel, notifyListeners) =>
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      notifyListeners,
    ),
);

export function subscribeToOrders(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  return subscribeOrdersRealtime(onChange);
}

export async function getSeenOrderIds(): Promise<string[]> {
  requireSupabaseConfigured('consultar las notificaciones de pedidos');

  const supabase = getSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('order_notification_reads')
    .select('order_id')
    .eq('admin_id', userData.user.id);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.order_id);
}

export async function markOrdersAsSeen(orderIds: string[]) {
  requireSupabaseConfigured('guardar las notificaciones vistas');
  if (!orderIds.length) return;

  const supabase = getSupabaseBrowserClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user) return;

  const { error } = await supabase
    .from('order_notification_reads')
    .upsert(
      orderIds.map((orderId) => ({
        admin_id: userData.user!.id,
        order_id: orderId,
      })),
      { onConflict: 'admin_id,order_id' },
    );

  if (error) throw new Error(error.message);
}

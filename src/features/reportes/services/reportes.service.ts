import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import type {
  ReportDataset,
  ReportFilters,
  ReportItem,
  ReportOrder,
  ReportSettledDeliveryCommission,
} from '../types/reporte.types';

const PAGE_SIZE = 1000;
const ITEM_ID_CHUNK_SIZE = 180;

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type DeliveryAssignmentRow = Database['public']['Tables']['delivery_assignments']['Row'];
type DeliverySettlementItemRow = Database['public']['Tables']['delivery_settlement_items']['Row'];
type DeliverySettlementRow = Database['public']['Tables']['delivery_settlements']['Row'];
type DeliveryCompensationRow = Database['public']['Tables']['delivery_assignment_compensation']['Row'];
type DeliveryRateRow = Database['public']['Tables']['delivery_driver_rates']['Row'];

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
    customerEmail: row.customer_email,
    deliveryMethod: row.delivery_method,
    address: row.address,
    customerLatitude: row.customer_latitude,
    customerLongitude: row.customer_longitude,
    deliveryDistanceKm: row.delivery_distance_km === null ? null : Number(row.delivery_distance_km),
    deliveryMapsUrl: row.delivery_maps_url,
    paymentMethod: row.payment_method,
    subtotal: Number(row.subtotal),
    deliveryCost: Number(row.delivery_cost),
    total: Number(row.total),
    status: row.status,
    notes: row.notes,
    source: row.source,
    acceptedAt: row.accepted_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    imageUrl: row.image_url,
    isPromotion: row.is_promotion,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    note: row.note,
    createdAt: row.created_at,
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

async function fetchSettledDeliveryCommissions(
  orders: ReportOrder[],
): Promise<ReportSettledDeliveryCommission[]> {
  const deliveryOrders = orders.filter((order) => order.deliveryMethod === 'delivery');
  if (!deliveryOrders.length) return [];

  const supabase = getSupabaseBrowserClient();
  const orderMap = new Map(deliveryOrders.map((order) => [order.id, order]));
  const assignments: Pick<DeliveryAssignmentRow, 'id' | 'order_id' | 'rate_id'>[] = [];

  for (let index = 0; index < deliveryOrders.length; index += ITEM_ID_CHUNK_SIZE) {
    const orderIds = deliveryOrders.slice(index, index + ITEM_ID_CHUNK_SIZE).map((order) => order.id);
    const { data, error } = await supabase
      .from('delivery_assignments')
      .select('id,order_id,rate_id')
      .in('order_id', orderIds)
      .eq('status', 'delivered');

    if (error) throw new Error(error.message);
    assignments.push(...((data ?? []) as Pick<DeliveryAssignmentRow, 'id' | 'order_id' | 'rate_id'>[]));
  }

  if (!assignments.length) return [];

  const assignmentIds = assignments.map((assignment) => assignment.id);
  const settlementItems: Pick<DeliverySettlementItemRow, 'settlement_id' | 'assignment_id'>[] = [];

  for (let index = 0; index < assignmentIds.length; index += ITEM_ID_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('delivery_settlement_items')
      .select('settlement_id,assignment_id')
      .in('assignment_id', assignmentIds.slice(index, index + ITEM_ID_CHUNK_SIZE));

    if (error) throw new Error(error.message);
    settlementItems.push(...((data ?? []) as Pick<DeliverySettlementItemRow, 'settlement_id' | 'assignment_id'>[]));
  }

  if (!settlementItems.length) return [];

  const settlementIds = [...new Set(settlementItems.map((item) => item.settlement_id))];
  const settlements: Pick<DeliverySettlementRow, 'id' | 'paid_at'>[] = [];

  for (let index = 0; index < settlementIds.length; index += ITEM_ID_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('delivery_settlements')
      .select('id,paid_at')
      .in('id', settlementIds.slice(index, index + ITEM_ID_CHUNK_SIZE))
      .eq('status', 'paid');

    if (error) throw new Error(error.message);
    settlements.push(...((data ?? []) as Pick<DeliverySettlementRow, 'id' | 'paid_at'>[]));
  }

  if (!settlements.length) return [];

  const settlementMap = new Map(settlements.map((settlement) => [settlement.id, settlement]));
  const settlementItemByAssignment = new Map(
    settlementItems
      .filter((item) => settlementMap.has(item.settlement_id))
      .map((item) => [item.assignment_id, item]),
  );
  const paidAssignments = assignments.filter((assignment) => settlementItemByAssignment.has(assignment.id));
  if (!paidAssignments.length) return [];

  const paidAssignmentIds = paidAssignments.map((assignment) => assignment.id);
  const compensations: Pick<DeliveryCompensationRow, 'assignment_id' | 'delivery_fee_snapshot' | 'commission_percent_override'>[] = [];

  for (let index = 0; index < paidAssignmentIds.length; index += ITEM_ID_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('delivery_assignment_compensation')
      .select('assignment_id,delivery_fee_snapshot,commission_percent_override')
      .in('assignment_id', paidAssignmentIds.slice(index, index + ITEM_ID_CHUNK_SIZE));

    if (error) throw new Error(error.message);
    compensations.push(...((data ?? []) as Pick<DeliveryCompensationRow, 'assignment_id' | 'delivery_fee_snapshot' | 'commission_percent_override'>[]));
  }

  const rateIds = [...new Set(paidAssignments.map((assignment) => assignment.rate_id))];
  const rates: Pick<DeliveryRateRow, 'id' | 'commission_percent'>[] = [];

  for (let index = 0; index < rateIds.length; index += ITEM_ID_CHUNK_SIZE) {
    const { data, error } = await supabase
      .from('delivery_driver_rates')
      .select('id,commission_percent')
      .in('id', rateIds.slice(index, index + ITEM_ID_CHUNK_SIZE));

    if (error) throw new Error(error.message);
    rates.push(...((data ?? []) as Pick<DeliveryRateRow, 'id' | 'commission_percent'>[]));
  }

  const compensationMap = new Map(compensations.map((row) => [row.assignment_id, row]));
  const rateMap = new Map(rates.map((rate) => [rate.id, rate]));

  return paidAssignments.flatMap((assignment) => {
    const order = orderMap.get(assignment.order_id);
    const settlementItem = settlementItemByAssignment.get(assignment.id);
    const settlement = settlementItem ? settlementMap.get(settlementItem.settlement_id) : undefined;
    const compensation = compensationMap.get(assignment.id);
    const rate = rateMap.get(assignment.rate_id);
    if (!order || !settlementItem || !settlement || !rate) return [];

    const deliveryFee = Number(compensation?.delivery_fee_snapshot ?? order.deliveryCost);
    const commissionPercent = Number(compensation?.commission_percent_override ?? rate.commission_percent);
    const amount = Math.round((deliveryFee * commissionPercent / 100) * 100) / 100;

    return [{
      settlementId: settlementItem.settlement_id,
      assignmentId: assignment.id,
      orderId: assignment.order_id,
      commissionPercent,
      deliveryFee,
      amount,
      paidAt: settlement.paid_at,
    }];
  });
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
  const [items, settledDeliveryCommissions] = await Promise.all([
    fetchItems(orders.map((order) => order.id)),
    fetchSettledDeliveryCommissions(orders),
  ]);

  return { orders, items, settledDeliveryCommissions };
}

export async function getCompleteReportData(): Promise<ReportDataset> {
  return getReportData({
    from: '',
    to: '',
    allTime: true,
    status: 'all',
    paymentMethod: 'all',
    deliveryMethod: 'all',
    search: '',
  });
}

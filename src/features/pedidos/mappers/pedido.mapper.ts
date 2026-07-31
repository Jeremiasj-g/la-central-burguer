import type { Order, OrderItem, OrderTimelineEntry } from '../types/pedido.types';
import type { Database } from '@/lib/supabase/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type HistoryRow = Database['public']['Tables']['order_status_history']['Row'];

export function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return { id: row.id, productId: row.product_id ?? '', productName: row.product_name, quantity: row.quantity, unitPrice: Number(row.unit_price), total: Number(row.total), note: row.note ?? undefined };
}
export function mapHistoryRow(row: HistoryRow): OrderTimelineEntry { return { status: row.status, date: row.created_at, description: row.description }; }
export function mapOrderRow(row: OrderRow, items: OrderItem[] = [], timeline: OrderTimelineEntry[] = []): Order {
  return {
    id: row.id, orderCode: row.order_code, customerId: row.customer_id ?? '', customerName: row.customer_name,
    customerPhone: row.customer_phone, customerEmail: row.customer_email ?? undefined, deliveryMethod: row.delivery_method,
    address: row.address ?? undefined, customerLat: row.customer_latitude ?? undefined, customerLng: row.customer_longitude ?? undefined,
    deliveryDistanceKm: row.delivery_distance_km ?? undefined, deliveryMapsUrl: row.delivery_maps_url ?? undefined,
    paymentMethod: row.payment_method, items, subtotal: Number(row.subtotal), deliveryCost: Number(row.delivery_cost), total: Number(row.total),
    status: row.status, notes: row.notes ?? undefined, timeline, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

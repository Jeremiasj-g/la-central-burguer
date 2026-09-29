import { getAccessManagementDashboard, resetAccessUserPassword, saveAccessUser, setAccessUserActive } from '@/features/access/services/access.service';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';
import type { DeliveryAdminDashboard, DeliveryHistoryPage, DriverFormPayload } from '../types/delivery-management.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;

function client() {
  requireSupabaseConfigured('gestionar delivery');
  return getSupabaseBrowserClient();
}

async function deliveryRpc<T>(name: string, args?: Record<string, unknown>) {
  const supabase = client();
  const invoke = supabase.rpc.bind(supabase) as unknown as RpcInvoker;
  const { data, error } = await invoke<T>(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function getDeliveryAdminDashboard(): Promise<DeliveryAdminDashboard> {
  const [delivery, access] = await Promise.all([
    deliveryRpc<DeliveryAdminDashboard>('get_delivery_admin_dashboard'),
    getAccessManagementDashboard(),
  ]);
  if (!delivery) throw new Error('El panel de delivery no devolvió información.');

  const activeUserIds = new Set(access.users.filter((user) => user.accessStatus === 'active').map((user) => user.id));
  const drivers = delivery.drivers.map((driver) => ({
    ...driver,
    active: driver.active && activeUserIds.has(driver.id),
  }));

  return {
    ...delivery,
    drivers,
    summary: {
      ...delivery.summary,
      activeDrivers: drivers.filter((driver) => driver.active).length,
    },
  };
}


export async function getDeliveryHistoryPage({
  page = 1,
  pageSize = 10,
}: {
  page?: number;
  pageSize?: number;
} = {}): Promise<DeliveryHistoryPage> {
  const supabase = client();
  const safePageSize = Math.max(1, Math.min(10, Math.trunc(pageSize)));
  const safePage = Math.max(1, Math.trunc(page));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  const { data: assignments, error: assignmentsError, count } = await supabase
    .from('delivery_assignments')
    .select(
      'id,order_id,rate_id,status,assigned_at,accepted_at,picked_up_at,in_transit_at,delivered_at,cancelled_at,cancellation_reason,rejected_at,rejection_reason',
      { count: 'exact' },
    )
    .order('assigned_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);

  if (assignmentsError) throw new Error(assignmentsError.message);

  const rows = assignments ?? [];
  if (!rows.length) {
    return { rows: [], total: count ?? 0, page: safePage, pageSize: safePageSize };
  }

  const assignmentIds = rows.map((row) => row.id);
  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const rateIds = [...new Set(rows.map((row) => row.rate_id))];

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,order_code,status,created_at,customer_name,customer_phone,address,delivery_maps_url,delivery_distance_km,subtotal,total,delivery_cost,payment_method')
    .in('id', orderIds);

  if (ordersError) throw new Error(ordersError.message);

  const { data: rates, error: ratesError } = await supabase
    .from('delivery_driver_rates')
    .select('id,driver_id,commission_percent')
    .in('id', rateIds);

  if (ratesError) throw new Error(ratesError.message);

  const driverIds = [...new Set((rates ?? []).map((row) => row.driver_id))];

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id,full_name')
    .in('id', driverIds);

  if (profilesError) throw new Error(profilesError.message);

  const { data: drivers, error: driversError } = await supabase
    .from('delivery_drivers')
    .select('profile_id,vehicle_type')
    .in('profile_id', driverIds);

  if (driversError) throw new Error(driversError.message);

  const { data: compensations, error: compensationsError } = await supabase
    .from('delivery_assignment_compensation')
    .select('assignment_id,delivery_fee_snapshot,commission_percent_override')
    .in('assignment_id', assignmentIds);

  if (compensationsError) throw new Error(compensationsError.message);

  const { data: events, error: eventsError } = await supabase
    .from('delivery_assignment_events')
    .select('assignment_id,status,actor_id,note,created_at')
    .in('assignment_id', assignmentIds)
    .order('created_at', { ascending: true });

  if (eventsError) throw new Error(eventsError.message);

  const { data: settlementItems, error: settlementItemsError } = await supabase
    .from('delivery_settlement_items')
    .select('assignment_id,settlement_id')
    .in('assignment_id', assignmentIds);

  if (settlementItemsError) throw new Error(settlementItemsError.message);

  const settlementIds = [...new Set((settlementItems ?? []).map((row) => row.settlement_id))];
  let settlements: Array<{ id: string; status: 'draft' | 'paid' | 'cancelled'; paid_at: string | null }> = [];

  if (settlementIds.length) {
    const { data, error } = await supabase
      .from('delivery_settlements')
      .select('id,status,paid_at')
      .in('id', settlementIds);

    if (error) throw new Error(error.message);
    settlements = data ?? [];
  }

  const orderMap = new Map((orders ?? []).map((row) => [row.id, row]));
  const rateMap = new Map((rates ?? []).map((row) => [row.id, row]));
  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]));
  const driverMap = new Map((drivers ?? []).map((row) => [row.profile_id, row]));
  const compensationMap = new Map((compensations ?? []).map((row) => [row.assignment_id, row]));
  const settlementItemMap = new Map((settlementItems ?? []).map((row) => [row.assignment_id, row]));
  const settlementMap = new Map(settlements.map((row) => [row.id, row]));
  const eventsMap = new Map<string, Array<{
    status: typeof rows[number]['status'];
    note: string | null;
    actorId: string | null;
    createdAt: string;
  }>>();

  for (const event of events ?? []) {
    const current = eventsMap.get(event.assignment_id) ?? [];
    current.push({
      status: event.status,
      note: event.note,
      actorId: event.actor_id,
      createdAt: event.created_at,
    });
    eventsMap.set(event.assignment_id, current);
  }

  return {
    rows: rows.map((assignment) => {
      const order = orderMap.get(assignment.order_id);
      const rate = rateMap.get(assignment.rate_id);
      const driverId = rate?.driver_id ?? '';
      const profile = profileMap.get(driverId);
      const driver = driverMap.get(driverId);
      const compensation = compensationMap.get(assignment.id);
      const deliveryFee = Number(compensation?.delivery_fee_snapshot ?? order?.delivery_cost ?? 0);
      const commissionPercent = Number(compensation?.commission_percent_override ?? rate?.commission_percent ?? 0);
      const settlementItem = settlementItemMap.get(assignment.id);
      const settlement = settlementItem ? settlementMap.get(settlementItem.settlement_id) : undefined;

      return {
        id: assignment.id,
        orderId: assignment.order_id,
        orderCode: order?.order_code ?? 'Sin código',
        orderStatus: order?.status ?? '—',
        orderCreatedAt: order?.created_at ?? assignment.assigned_at,
        customerName: order?.customer_name ?? 'Sin cliente',
        customerPhone: order?.customer_phone ?? 'Sin teléfono',
        address: order?.address ?? null,
        mapsUrl: order?.delivery_maps_url ?? null,
        distanceKm: order?.delivery_distance_km === null || order?.delivery_distance_km === undefined
          ? null
          : Number(order.delivery_distance_km),
        subtotal: Number(order?.subtotal ?? 0),
        orderTotal: Number(order?.total ?? 0),
        deliveryFee,
        paymentMethod: order?.payment_method ?? 'efectivo',
        driverId,
        driverName: profile?.full_name ?? 'Repartidor no disponible',
        vehicleType: driver?.vehicle_type ?? 'otro',
        status: assignment.status,
        commissionPercent,
        commissionAmount: Math.round((deliveryFee * commissionPercent / 100) * 100) / 100,
        cashToCollect: order?.payment_method === 'efectivo' ? Number(order.total) : 0,
        assignedAt: assignment.assigned_at,
        acceptedAt: assignment.accepted_at,
        pickedUpAt: assignment.picked_up_at,
        inTransitAt: assignment.in_transit_at,
        deliveredAt: assignment.delivered_at,
        rejectedAt: assignment.rejected_at,
        rejectionReason: assignment.rejection_reason,
        cancelledAt: assignment.cancelled_at,
        cancellationReason: assignment.cancellation_reason,
        settlementId: settlementItem?.settlement_id ?? null,
        settlementStatus: settlement?.status ?? null,
        settlementPaidAt: settlement?.paid_at ?? null,
        events: eventsMap.get(assignment.id) ?? [],
      };
    }),
    total: count ?? 0,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function assignDelivery(
  orderId: string,
  driverId: string,
  commissionPercentOverride: number | null = null,
  note?: string,
) {
  await deliveryRpc<string>('admin_assign_delivery', {
    order_uuid: orderId,
    driver_uuid: driverId,
    note: note?.trim() || null,
    commission_percent_override: commissionPercentOverride,
  });
}

export async function cancelDeliveryAssignment(assignmentId: string, reason?: string) {
  await deliveryRpc<null>('admin_cancel_delivery_assignment', {
    assignment_uuid: assignmentId,
    reason: reason?.trim() || null,
  });
}

export async function createDeliverySettlement(driverId: string, from: string, to: string, notes?: string) {
  const fromTs = new Date(`${from}T00:00:00`).toISOString();
  const toDate = new Date(`${to}T00:00:00`);
  toDate.setDate(toDate.getDate() + 1);
  await deliveryRpc<string>('admin_create_delivery_settlement', {
    driver_uuid: driverId,
    from_ts: fromTs,
    to_ts: toDate.toISOString(),
    settlement_notes: notes?.trim() || null,
  });
}

export async function markDeliverySettlementPaid(settlementId: string) {
  await deliveryRpc<null>('admin_mark_delivery_settlement_paid', {
    settlement_uuid: settlementId,
  });
}

export async function cancelDeliverySettlement(settlementId: string) {
  await deliveryRpc<null>('admin_cancel_delivery_settlement', {
    settlement_uuid: settlementId,
  });
}

const subscribeDeliveryOrdersRealtime = createSharedRealtimeSubscription(
  'delivery-admin-operation',
  (channel, notifyListeners) =>
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        notifyListeners,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_assignments' },
        notifyListeners,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_assignment_compensation' },
        notifyListeners,
      ),
);

export function subscribeToDeliveryOrders(onChange: () => void) {
  return subscribeDeliveryOrdersRealtime(onChange);
}

export async function saveDeliveryDriver(payload: DriverFormPayload) {
  const access = await getAccessManagementDashboard();
  const deliveryRole = access.roles.find((role) => role.code === 'delivery' && role.active);
  if (!deliveryRole) throw new Error('El rol Delivery no está disponible.');

  const existingUser = payload.driverId ? access.users.find((user) => user.id === payload.driverId) : undefined;
  const roleIds = existingUser
    ? [...new Set([...existingUser.roles.map((role) => role.id), deliveryRole.id])]
    : [deliveryRole.id];

  await saveAccessUser({
    userId: payload.driverId,
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    notes: existingUser?.notes ?? '',
    roleIds,
    vehicleType: payload.vehicleType,
    commissionPercent: payload.commissionPercent,
  });
}

export async function toggleDeliveryDriver(driverId: string, active: boolean) {
  await setAccessUserActive(driverId, active);
}

export async function resetDeliveryDriverPassword(driverId: string, password: string) {
  await resetAccessUserPassword(driverId, password);
}

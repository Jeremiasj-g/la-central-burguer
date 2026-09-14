import { getAccessManagementDashboard, resetAccessUserPassword, saveAccessUser, setAccessUserActive } from '@/features/access/services/access.service';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';
import type { DeliveryAdminDashboard, DriverFormPayload } from '../types/delivery-management.types';

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

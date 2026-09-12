import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { DeliveryAdminDashboard, DriverFormPayload } from '../types/delivery-management.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;

function client() {
  requireSupabaseConfigured('gestionar delivery');
  return getSupabaseBrowserClient();
}

async function deliveryRpc<T>(name: string, args?: Record<string, unknown>) {
  const supabase = client();
  const invoke = supabase.rpc as unknown as RpcInvoker;
  const { data, error } = await invoke<T>(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export async function getDeliveryAdminDashboard(): Promise<DeliveryAdminDashboard> {
  const data = await deliveryRpc<DeliveryAdminDashboard>('get_delivery_admin_dashboard');
  if (!data) throw new Error('El panel de delivery no devolvió información.');
  return data;
}

export async function assignDelivery(orderId: string, driverId: string, note?: string) {
  await deliveryRpc<string>('admin_assign_delivery', {
    order_uuid: orderId,
    driver_uuid: driverId,
    note: note?.trim() || null,
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

function edgeError(data: unknown) {
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return null;
}

export async function saveDeliveryDriver(payload: DriverFormPayload) {
  const { data, error } = await client().functions.invoke('manage-delivery-driver', {
    body: {
      action: payload.driverId ? 'update' : 'create',
      ...payload,
    },
  });
  if (error) throw new Error(error.message);
  const message = edgeError(data);
  if (message) throw new Error(message);
}

export async function toggleDeliveryDriver(driverId: string, active: boolean) {
  const { data, error } = await client().functions.invoke('manage-delivery-driver', {
    body: { action: 'toggle', driverId, active },
  });
  if (error) throw new Error(error.message);
  const message = edgeError(data);
  if (message) throw new Error(message);
}

export async function resetDeliveryDriverPassword(driverId: string, password: string) {
  const { data, error } = await client().functions.invoke('manage-delivery-driver', {
    body: { action: 'resetPassword', driverId, password },
  });
  if (error) throw new Error(error.message);
  const message = edgeError(data);
  if (message) throw new Error(message);
}

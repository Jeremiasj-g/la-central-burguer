import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { DeliveryAdminDashboard, DriverFormPayload } from '../types/delivery-management.types';

function client() {
  requireSupabaseConfigured('gestionar delivery');
  return getSupabaseBrowserClient() as any;
}

export async function getDeliveryAdminDashboard(): Promise<DeliveryAdminDashboard> {
  const { data, error } = await client().rpc('get_delivery_admin_dashboard');
  if (error) throw new Error(error.message);
  return data as DeliveryAdminDashboard;
}

export async function assignDelivery(orderId: string, driverId: string, note?: string) {
  const { error } = await client().rpc('admin_assign_delivery', {
    order_uuid: orderId,
    driver_uuid: driverId,
    note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function cancelDeliveryAssignment(assignmentId: string, reason?: string) {
  const { error } = await client().rpc('admin_cancel_delivery_assignment', {
    assignment_uuid: assignmentId,
    reason: reason?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function createDeliverySettlement(driverId: string, from: string, to: string, notes?: string) {
  const fromTs = new Date(`${from}T00:00:00`).toISOString();
  const toDate = new Date(`${to}T00:00:00`);
  toDate.setDate(toDate.getDate() + 1);
  const { error } = await client().rpc('admin_create_delivery_settlement', {
    driver_uuid: driverId,
    from_ts: fromTs,
    to_ts: toDate.toISOString(),
    settlement_notes: notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function markDeliverySettlementPaid(settlementId: string) {
  const { error } = await client().rpc('admin_mark_delivery_settlement_paid', {
    settlement_uuid: settlementId,
  });
  if (error) throw new Error(error.message);
}

export async function cancelDeliverySettlement(settlementId: string) {
  const { error } = await client().rpc('admin_cancel_delivery_settlement', {
    settlement_uuid: settlementId,
  });
  if (error) throw new Error(error.message);
}

export async function saveDeliveryDriver(payload: DriverFormPayload) {
  const { data, error } = await client().functions.invoke('manage-delivery-driver', {
    body: {
      action: payload.driverId ? 'update' : 'create',
      ...payload,
    },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function toggleDeliveryDriver(driverId: string, active: boolean) {
  const { data, error } = await client().functions.invoke('manage-delivery-driver', {
    body: { action: 'toggle', driverId, active },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

export async function resetDeliveryDriverPassword(driverId: string, password: string) {
  const { data, error } = await client().functions.invoke('manage-delivery-driver', {
    body: { action: 'resetPassword', driverId, password },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}

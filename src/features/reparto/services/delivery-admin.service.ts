import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { DeliveryAdminDashboard, DriverFormPayload } from '../types/delivery-management.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;

type AccessDashboard = {
  users: Array<{ id: string; roles: Array<{ id: string; code: string; name: string }> }>;
  roles: Array<{ id: string; code: string; name: string; active: boolean }>;
};

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

async function getAccessDashboard() {
  const data = await deliveryRpc<AccessDashboard>('get_access_management_dashboard');
  if (!data) throw new Error('No se pudo obtener la configuración de usuarios y roles.');
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
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error;
  return null;
}

async function invokeAccessUser(body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke('manage-access-user', { body });
  if (error) throw new Error(error.message);
  const message = edgeError(data);
  if (message) throw new Error(message);
}

export async function saveDeliveryDriver(payload: DriverFormPayload) {
  const access = await getAccessDashboard();
  const deliveryRole = access.roles.find((role) => role.code === 'delivery' && role.active);
  if (!deliveryRole) throw new Error('El rol Delivery no está disponible.');

  const existingUser = payload.driverId ? access.users.find((user) => user.id === payload.driverId) : undefined;
  const roleIds = existingUser
    ? [...new Set([...existingUser.roles.map((role) => role.id), deliveryRole.id])]
    : [deliveryRole.id];

  await invokeAccessUser({
    action: payload.driverId ? 'update' : 'create',
    userId: payload.driverId,
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    phone: payload.phone,
    roleIds,
    vehicleType: payload.vehicleType,
    commissionPercent: payload.commissionPercent,
  });
}

export async function toggleDeliveryDriver(driverId: string, active: boolean) {
  await invokeAccessUser({ action: 'setActive', userId: driverId, active });
}

export async function resetDeliveryDriverPassword(driverId: string, password: string) {
  await invokeAccessUser({ action: 'resetPassword', userId: driverId, password });
}

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { DeliveryAssignmentStatus, DeliveryDriverDashboard } from '../types/delivery-management.types';

type RpcError = { message: string } | null;
type RpcInvoker = <T>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;
type AccessContext = {
  userId: string;
  fullName: string;
  phone: string | null;
  active: boolean;
  email: string | null;
  roles: string[];
  permissions: string[];
};

function client() {
  requireSupabaseConfigured('usar el panel de repartidor');
  return getSupabaseBrowserClient();
}

async function deliveryRpc<T>(name: string, args?: Record<string, unknown>) {
  const supabase = client();
  const invoke = supabase.rpc.bind(supabase) as unknown as RpcInvoker;
  const { data, error } = await invoke<T>(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function getAccessContext() {
  return deliveryRpc<AccessContext>('get_current_access_context');
}

export async function loginDeliveryDriver(email: string, password: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
  }
  if (!data.user) throw new Error('No se pudo validar el usuario.');

  try {
    const access = await getAccessContext();
    if (!access?.active || !access.roles.includes('delivery')) throw new Error('Sin rol de delivery.');
    await deliveryRpc<DeliveryDriverDashboard>('get_delivery_driver_dashboard');
  } catch {
    await supabase.auth.signOut();
    throw new Error('Este usuario no tiene acceso al panel de reparto.');
  }
}

export async function isDeliveryDriverLoggedIn() {
  const supabase = client();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  try {
    const access = await getAccessContext();
    return Boolean(access?.active && access.roles.includes('delivery'));
  } catch {
    return false;
  }
}

export async function logoutDeliveryDriver() {
  const { error } = await client().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getDeliveryDriverDashboard(): Promise<DeliveryDriverDashboard> {
  const data = await deliveryRpc<DeliveryDriverDashboard>('get_delivery_driver_dashboard');
  if (!data) throw new Error('El panel de reparto no devolvió información.');
  return data;
}

export async function advanceDeliveryAssignment(
  assignmentId: string,
  nextStatus: DeliveryAssignmentStatus,
  note?: string,
) {
  await deliveryRpc<unknown>('driver_advance_delivery', {
    assignment_uuid: assignmentId,
    next_status: nextStatus,
    note: note?.trim() || null,
  });
}

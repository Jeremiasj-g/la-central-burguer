import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import type { DeliveryAssignmentStatus, DeliveryDriverDashboard } from '../types/delivery-management.types';

function client() {
  requireSupabaseConfigured('usar el panel de repartidor');
  return getSupabaseBrowserClient() as any;
}

export async function loginDeliveryDriver(email: string, password: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
  }
  if (!data.user) throw new Error('No se pudo validar el usuario.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name,role,active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'delivery' || !profile.active) {
    await supabase.auth.signOut();
    throw new Error('Este usuario no tiene acceso al panel de reparto.');
  }

  const { error: dashboardError } = await supabase.rpc('get_delivery_driver_dashboard');
  if (dashboardError) {
    await supabase.auth.signOut();
    throw new Error('El repartidor no está habilitado para operar.');
  }
}

export async function isDeliveryDriverLoggedIn() {
  const supabase = client();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,active')
    .eq('id', data.user.id)
    .maybeSingle();
  return Boolean(profile?.role === 'delivery' && profile?.active);
}

export async function logoutDeliveryDriver() {
  const { error } = await client().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getDeliveryDriverDashboard(): Promise<DeliveryDriverDashboard> {
  const { data, error } = await client().rpc('get_delivery_driver_dashboard');
  if (error) throw new Error(error.message);
  return data as DeliveryDriverDashboard;
}

export async function advanceDeliveryAssignment(
  assignmentId: string,
  nextStatus: DeliveryAssignmentStatus,
  note?: string,
) {
  const { error } = await client().rpc('driver_advance_delivery', {
    assignment_uuid: assignmentId,
    next_status: nextStatus,
    note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
}

import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface AdminSession {
  id?: string;
  email: string;
  name: string;
  role: 'admin';
  createdAt: string;
}

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

async function getAccessContext(): Promise<AccessContext | null> {
  const supabase = getSupabaseBrowserClient();
  const invoke = supabase.rpc.bind(supabase) as unknown as RpcInvoker;
  const { data, error } = await invoke<AccessContext>('get_current_access_context');
  if (error) throw new Error(error.message);
  return data;
}

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  requireSupabaseConfigured('iniciar sesión en el panel administrador');

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new Error(
      error.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos.'
        : error.message,
    );
  }

  if (!data.user) throw new Error('No se pudo obtener el usuario autenticado.');

  try {
    const access = await getAccessContext();
    if (!access?.active || !access.roles.includes('admin')) throw new Error('Sin rol administrador.');

    return {
      id: data.user.id,
      email: data.user.email ?? email,
      name: access.fullName || 'Administrador',
      role: 'admin',
      createdAt: data.user.created_at,
    };
  } catch {
    await supabase.auth.signOut();
    throw new Error('Este usuario no tiene permisos para ingresar al panel.');
  }
}

export async function logoutAdmin() {
  requireSupabaseConfigured('cerrar la sesión administrativa');
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  requireSupabaseConfigured('validar la sesión administrativa');

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  try {
    const access = await getAccessContext();
    if (!access?.active || !access.roles.includes('admin')) return null;

    return {
      id: data.user.id,
      email: data.user.email ?? '',
      name: access.fullName || 'Administrador',
      role: 'admin',
      createdAt: data.user.created_at,
    };
  } catch {
    return null;
  }
}

export async function isAdminLoggedIn() {
  return Boolean(await getAdminSession());
}

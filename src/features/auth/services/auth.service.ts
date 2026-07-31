import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface AdminSession {
  id?: string;
  email: string;
  name: string;
  role: 'admin';
  createdAt: string;
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name,role,active')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || !profile.active) {
    await supabase.auth.signOut();
    throw new Error('Este usuario no tiene permisos para ingresar al panel.');
  }

  return {
    id: data.user.id,
    email: data.user.email ?? email,
    name: profile.full_name || 'Administrador',
    role: 'admin',
    createdAt: data.user.created_at,
  };
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name,role,active')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin' || !profile.active) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? '',
    name: profile.full_name || 'Administrador',
    role: 'admin',
    createdAt: data.user.created_at,
  };
}

export async function isAdminLoggedIn() {
  return Boolean(await getAdminSession());
}

import 'server-only';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { AdminSession } from './auth.service';

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === 'string' ? claims.sub : null;

  if (error || !userId) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name,role,active')
    .eq('id', userId)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin' || !profile.active) return null;

  return {
    id: userId,
    email: typeof claims?.email === 'string' ? claims.email : '',
    name: profile.full_name || 'Administrador',
    role: 'admin',
    createdAt: typeof claims?.iat === 'number'
      ? new Date(claims.iat * 1000).toISOString()
      : '',
  };
}

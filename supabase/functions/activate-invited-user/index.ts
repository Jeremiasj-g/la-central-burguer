import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return out({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return out({ error: 'Configuración incompleta.' }, 500);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return out({ error: 'Sesión inválida o vencida.' }, 401);
  if (!auth.user.email_confirmed_at) return out({ error: 'Primero debés verificar tu email.' }, 400);

  const { data: memberships, error: membershipsError } = await db.from('user_roles').select('role_id').eq('user_id', auth.user.id);
  if (membershipsError) return out({ error: membershipsError.message }, 400);
  const roleIds = (memberships ?? []).map((row: { role_id: string }) => row.role_id);
  if (roleIds.length === 0) return out({ error: 'Tu cuenta no tiene roles asignados.' }, 400);

  const { data: roles, error: rolesError } = await db.from('roles').select('code').in('id', roleIds).eq('active', true);
  if (rolesError) return out({ error: rolesError.message }, 400);
  const roleCodes = (roles ?? []).map((role: { code: string }) => role.code);

  const { error: profileError } = await db.from('profiles').update({ active: true, archived_at: null }).eq('id', auth.user.id);
  if (profileError) return out({ error: profileError.message }, 400);

  if (roleCodes.includes('delivery')) {
    const { error: driverError } = await db.from('delivery_drivers').update({ active: true }).eq('profile_id', auth.user.id);
    if (driverError) return out({ error: driverError.message }, 400);
  }

  return out({ ok: true, roles: roleCodes });
});

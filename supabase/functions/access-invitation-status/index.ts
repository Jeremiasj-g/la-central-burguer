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
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return out({ error: 'Sesión inválida.' }, 401);

  const { data: role } = await supabase.from('roles').select('id').eq('code', 'admin').eq('active', true).maybeSingle();
  if (!role) return out({ error: 'No autorizado.' }, 403);
  const { data: membership } = await supabase.from('user_roles').select('user_id').eq('user_id', auth.user.id).eq('role_id', role.id).maybeSingle();
  if (!membership) return out({ error: 'No autorizado.' }, 403);

  const body = await req.json();
  const ids = Array.isArray(body.userIds) ? [...new Set(body.userIds.map(String))].slice(0, 200) : [];
  const users = [];
  for (const id of ids) {
    const { data } = await supabase.auth.admin.getUserById(id);
    if (data.user) {
      users.push({
        userId: id,
        invitedAt: data.user.invited_at ?? null,
        confirmationSentAt: data.user.confirmation_sent_at ?? null,
        emailConfirmedAt: data.user.email_confirmed_at ?? null,
      });
    }
  }
  return out({ users });
});

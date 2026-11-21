import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) return respond({ error: 'Configuración del servidor incompleta.' }, 500);
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return respond({ error: 'Iniciá sesión como administrador.' }, 401);

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actor, error: authError } = await admin.auth.getUser(bearer);
  if (authError || !actor.user) return respond({ error: 'Sesión no válida.' }, 401);

  // Check the same active-admin membership used by manage-access-user.
  const { data: profile } = await admin.from('profiles').select('active,archived_at')
    .eq('id', actor.user.id).maybeSingle();
  const { data: role } = await admin.from('roles').select('id')
    .eq('code', 'admin').eq('active', true).maybeSingle();
  if (!profile?.active || profile.archived_at || !role) return respond({ error: 'No autorizado.' }, 403);
  const { data: membership } = await admin.from('user_roles').select('user_id')
    .eq('user_id', actor.user.id).eq('role_id', role.id).maybeSingle();
  if (!membership) return respond({ error: 'No autorizado.' }, 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return respond({ error: 'Solicitud inválida.' }, 400); }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const phone = String(body.phone ?? '').trim();
  const address = String(body.address ?? '').trim();
  if (name.length < 2 || name.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    password.length < 8 || password.length > 128 ||
    phone.length > 40 || (phone && phone.replace(/\D/g, '').length < 6) ||
    address.length > 240) {
    return respond({ error: 'Revisá nombre, email, contraseña (mínimo 8 caracteres), teléfono y dirección.' }, 400);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name },
  });
  if (createError || !created.user) {
    const duplicate = /already|registered|exists|email_exists/i.test(createError?.message ?? '');
    return respond({ error: duplicate ? 'Ya existe una cuenta con ese correo.' : 'No se pudo crear la cuenta de acceso.' }, 400);
  }
  const userId = created.user.id;
  const { error: accountError } = await admin.from('customer_accounts').insert({
    user_id: userId, full_name: name, phone, address,
  });
  if (accountError) {
    await admin.auth.admin.deleteUser(userId);
    return respond({ error: 'No se pudo guardar el perfil del cliente. No se creó la cuenta.' }, 500);
  }
  return respond({ ok: true, userId });
});

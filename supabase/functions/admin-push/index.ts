import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const text = (value: unknown) => String(value ?? '').trim();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type PushResult = { sent: number; failed: number; subscriptionCount: number; firstError: string | null };
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string };
type AdminDb = ReturnType<typeof createClient>;

async function requireAdmin(db: AdminDb, userId: string) {
  const [{ data: profile, error: profileError }, { data: role, error: roleError }] = await Promise.all([
    db.from('profiles').select('active,archived_at').eq('id', userId).maybeSingle(),
    db.from('roles').select('id').eq('code', 'admin').eq('active', true).maybeSingle(),
  ]);
  if (profileError || roleError || !profile?.active || profile.archived_at || !role) {
    throw new Error('Sin acceso al panel administrativo.');
  }
  const { data: assigned, error } = await db.from('user_roles')
    .select('user_id').eq('user_id', userId).eq('role_id', role.id).maybeSingle();
  if (error || !assigned) throw new Error('Sin acceso al panel administrativo.');
}

async function pushConfig(db: AdminDb) {
  const { data, error } = await db.from('app_push_config')
    .select('vapid_public_key,vapid_private_key,subject').eq('id', 1).maybeSingle();
  if (error || !data?.vapid_public_key || !data?.vapid_private_key) {
    throw new Error('Falta la configuración de notificaciones Web Push.');
  }
  return data;
}

async function sendToSubscriptions(db: AdminDb, subscriptions: Subscription[],
  config: Awaited<ReturnType<typeof pushConfig>>, payload: (userId: string) => Record<string, unknown>): Promise<PushResult> {
  if (!subscriptions.length) return { sent: 0, failed: 0, subscriptionCount: 0, firstError: null };
  webpush.setVapidDetails(config.subject, config.vapid_public_key, config.vapid_private_key);
  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;

  await Promise.all(subscriptions.map(async (entry) => {
    try {
      await webpush.sendNotification({
        endpoint: entry.endpoint,
        keys: { p256dh: entry.p256dh, auth: entry.auth_key },
      }, JSON.stringify(payload(entry.user_id)), { TTL: 600, urgency: 'high' });
      sent += 1;
    } catch (error: unknown) {
      failed += 1;
      const e = error as { statusCode?: number; message?: string };
      if (!firstError) firstError = e.message ?? 'El proveedor Push rechazó la notificación.';
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.from('admin_push_subscriptions').delete().eq('id', entry.id);
      }
      console.error('admin-push send', { statusCode: e.statusCode ?? null });
    }
  }));
  return { sent, failed, subscriptionCount: subscriptions.length, firstError };
}

async function verifyOrderSignature(orderId: string, sentAt: number, signature: string, secret: string) {
  if (!uuidPattern.test(orderId) || !Number.isSafeInteger(sentAt) || Math.abs(Date.now() - sentAt) > 120_000
      || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = new Uint8Array(signature.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
  return crypto.subtle.verify('HMAC', key, bytes,
    new TextEncoder().encode(`lcb-admin-order:v1:${orderId}:${sentAt}`));
}

async function unreadCounts(db: AdminDb, userIds: string[]) {
  const { data: pending, error: orderError } = await db.from('orders')
    .select('id').eq('status', 'aceptado').limit(10000);
  if (orderError) throw orderError;
  const ids = (pending ?? []).map((row) => row.id);
  const unread = new Map<string, number>();
  for (const id of userIds) unread.set(id, ids.length);
  if (!ids.length || !userIds.length) return unread;
  const { data: viewed, error: readError } = await db.from('order_notification_reads')
    .select('admin_id,order_id').in('admin_id', userIds).in('order_id', ids).limit(100000);
  if (readError) throw readError;
  for (const item of viewed ?? []) {
    unread.set(item.admin_id, Math.max(0, (unread.get(item.admin_id) ?? 0) - 1));
  }
  return unread;
}

async function notifyNewOrder(db: AdminDb, input: Record<string, unknown>) {
  const orderId = text(input.orderId);
  const sentAt = Number(input.sentAt);
  const signature = text(input.signature);
  const config = await pushConfig(db);
  if (!await verifyOrderSignature(orderId, sentAt, signature, config.vapid_private_key)) {
    return json({ error: 'Firma de notificación inválida.' }, 403);
  }

  const { data: order, error: orderError } = await db.from('orders')
    .select('id,order_code,customer_name,total,status').eq('id', orderId).maybeSingle();
  if (orderError || !order || order.status !== 'aceptado') {
    return json({ error: 'No hay un pedido nuevo válido para notificar.' }, 404);
  }
  const { data: adminRole, error: roleError } = await db.from('roles')
    .select('id').eq('code', 'admin').eq('active', true).maybeSingle();
  if (roleError || !adminRole) throw new Error('No existe el rol administrador activo.');

  const { data: assignments, error: assignmentsError } = await db.from('user_roles')
    .select('user_id').eq('role_id', adminRole.id);
  if (assignmentsError) throw assignmentsError;
  const ids = [...new Set((assignments ?? []).map((a) => a.user_id))];
  if (!ids.length) return json({ ok: true, sent: 0, reason: 'Sin administradores' });

  const [{ data: profiles, error: profileError }, { data: devices, error: deviceError }] = await Promise.all([
    db.from('profiles').select('id').in('id', ids).eq('active', true).is('archived_at', null),
    db.from('admin_push_subscriptions').select('id,user_id,endpoint,p256dh,auth_key').in('user_id', ids),
  ]);
  if (profileError || deviceError) throw profileError ?? deviceError;
  const allowed = new Set((profiles ?? []).map((p) => p.id));
  const subscriptions = ((devices ?? []) as Subscription[]).filter((d) => allowed.has(d.user_id));
  if (!subscriptions.length) return json({ ok: true, sent: 0, subscriptionCount: 0 });

  // Una tanda de Push por pedido. Esta restricción también evita duplicados por reintentos.
  const { error: dispatchError } = await db.from('admin_push_dispatches')
    .insert({ order_id: order.id });
  if (dispatchError) {
    if (dispatchError.code === '23505') return json({ ok: true, duplicate: true, sent: 0 });
    throw dispatchError;
  }

  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const counts = await unreadCounts(db, userIds);
  const amount = Number(order.total ?? 0).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  });
  const result = await sendToSubscriptions(db, subscriptions, config, (userId) => ({
    title: '🍔 Nuevo pedido en La Central',
    body: `${order.order_code} · ${order.customer_name} · ${amount}`,
    tag: `admin-order-${order.id}`,
    url: '/admin/pedidos',
    orderId: order.id,
    badgeCount: Math.max(1, counts.get(userId) ?? 1),
  }));
  return json({ ok: true, ...result });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const privateKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !privateKey) return json({ error: 'La función no está configurada.' }, 500);
  const db = createClient(url, privateKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = text(body?.action);

    // No accesible desde el navegador: sólo desde el servidor después del commit del pedido.
    if (action === 'notifyNewOrder') return await notifyNewOrder(db, body);

    const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'Sesión requerida.' }, 401);
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Sesión inválida.' }, 401);
    const userId = auth.user.id;
    await requireAdmin(db, userId);

    if (action === 'getPublicKey') {
      const config = await pushConfig(db);
      return json({ publicKey: config.vapid_public_key });
    }
    if (action === 'subscribe') {
      const sub = body.subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | undefined;
      const endpoint = text(sub?.endpoint);
      const p256dh = text(sub?.keys?.p256dh);
      const auth = text(sub?.keys?.auth);
      if (!endpoint.startsWith('https://') || !p256dh || !auth) {
        return json({ error: 'Suscripción inválida.' }, 400);
      }
      const stamp = new Date().toISOString();
      const { error } = await db.from('admin_push_subscriptions').upsert({
        user_id: userId, endpoint, p256dh, auth_key: auth,
        user_agent: text(body.userAgent).slice(0, 500) || null,
        last_seen_at: stamp, updated_at: stamp,
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === 'unsubscribe') {
      const endpoint = text(body.endpoint);
      if (endpoint) {
        const { error } = await db.from('admin_push_subscriptions').delete()
          .eq('user_id', userId).eq('endpoint', endpoint);
        if (error) throw error;
      }
      return json({ ok: true });
    }
    if (action === 'testSelf') {
      const { data, error } = await db.from('admin_push_subscriptions')
        .select('id,user_id,endpoint,p256dh,auth_key').eq('user_id', userId);
      if (error) throw error;
      const config = await pushConfig(db);
      const counts = await unreadCounts(db, [userId]);
      const result = await sendToSubscriptions(db, (data ?? []) as Subscription[], config, () => ({
        title: '🍔 Notificaciones funcionando',
        body: 'La Central Admin te avisará cuando ingrese un pedido nuevo.',
        tag: `admin-push-test-${Date.now()}`,
        url: '/admin/pedidos',
        badgeCount: counts.get(userId) ?? 0,
      }));
      return json({ ok: true, ...result });
    }
    return json({ error: 'Acción no disponible.' }, 400);
  } catch (error) {
    console.error('admin-push:', error instanceof Error ? error.message : 'Error desconocido');
    return json({ error: error instanceof Error ? error.message : 'No se pudo procesar la solicitud.' }, 400);
  }
});
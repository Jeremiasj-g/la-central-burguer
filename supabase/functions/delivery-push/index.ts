import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

async function assertRole(admin: any, userId: string, roleCode: 'admin' | 'delivery') {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,active,archived_at')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || !profile.active || profile.archived_at) throw new Error('No autorizado.');

  const { data: role, error: roleError } = await admin
    .from('roles')
    .select('id')
    .eq('code', roleCode)
    .eq('active', true)
    .maybeSingle();

  if (roleError) throw roleError;
  if (!role) throw new Error('Rol no disponible.');

  const { data: assignment, error: assignmentError } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', userId)
    .eq('role_id', role.id)
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error('No autorizado.');
}

async function getPushConfig(admin: any) {
  const { data, error } = await admin
    .from('app_push_config')
    .select('vapid_public_key,vapid_private_key,subject')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.vapid_public_key || !data?.vapid_private_key) {
    throw new Error('Web Push todavía no está configurado.');
  }

  return data;
}

type PushSendResult = {
  sent: number;
  failed: number;
  subscriptionCount: number;
  firstError: string | null;
};

async function sendPushToUser(
  admin: any,
  userId: string,
  payload: Record<string, unknown>,
): Promise<PushSendResult> {
  const { data: subscriptions, error: subscriptionsError } = await admin
    .from('delivery_push_subscriptions')
    .select('id,endpoint,p256dh,auth_key')
    .eq('user_id', userId);

  if (subscriptionsError) throw subscriptionsError;
  if (!subscriptions?.length) {
    return { sent: 0, failed: 0, subscriptionCount: 0, firstError: null };
  }

  const pushConfig = await getPushConfig(admin);
  webpush.setVapidDetails(
    pushConfig.subject,
    pushConfig.vapid_public_key,
    pushConfig.vapid_private_key,
  );

  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;

  await Promise.all(subscriptions.map(async (subscription: any) => {
    try {
      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_key,
          },
        },
        JSON.stringify(payload),
        { TTL: 300, urgency: 'high' },
      );

      sent += 1;
      console.log('delivery-push accepted', JSON.stringify({
        statusCode: result?.statusCode ?? null,
        userId,
      }));
    } catch (error: any) {
      failed += 1;
      const statusCode = Number(error?.statusCode ?? 0);
      const providerBody = text(error?.body);
      const message = providerBody || text(error?.message) || 'El proveedor rechazó la notificación.';
      firstError ??= statusCode ? `HTTP ${statusCode}: ${message}` : message;

      console.error('delivery-push send failed', JSON.stringify({
        statusCode,
        message,
        userId,
      }));

      if (statusCode === 404 || statusCode === 410) {
        await admin.from('delivery_push_subscriptions').delete().eq('id', subscription.id);
      }
    }
  }));

  return {
    sent,
    failed,
    subscriptionCount: subscriptions.length,
    firstError,
  };
}

async function notifyAssignment(admin: any, assignmentId: string) {
  const { data: assignment, error: assignmentError } = await admin
    .from('delivery_assignments')
    .select('id,order_id,rate_id,status')
    .eq('id', assignmentId)
    .maybeSingle();

  if (assignmentError) throw assignmentError;
  if (!assignment) throw new Error('Asignación no encontrada.');

  const [{ data: rate, error: rateError }, { data: order, error: orderError }] = await Promise.all([
    admin
      .from('delivery_driver_rates')
      .select('driver_id')
      .eq('id', assignment.rate_id)
      .maybeSingle(),
    admin
      .from('orders')
      .select('order_code,customer_name,total,payment_method,delivery_route_distance_km,delivery_distance_km')
      .eq('id', assignment.order_id)
      .maybeSingle(),
  ]);

  if (rateError) throw rateError;
  if (orderError) throw orderError;
  if (!rate?.driver_id || !order) throw new Error('No se pudo resolver el repartidor o el pedido.');

  const distance = Number(order.delivery_route_distance_km ?? order.delivery_distance_km ?? 0);
  const payment = order.payment_method === 'efectivo' ? 'Efectivo' : 'Transferencia';
  const amount = Number(order.total ?? 0).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

  return sendPushToUser(admin, rate.driver_id, {
    title: '🍔 Nuevo pedido asignado',
    body: `${order.order_code} · ${order.customer_name} · ${distance > 0 ? `${distance.toFixed(1)} km · ` : ''}${payment} ${amount}`,
    tag: `delivery-${assignment.id}`,
    url: '/delivery',
    assignmentId: assignment.id,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'La función no tiene configuradas las credenciales del proyecto.' }, 500);
  }

  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sesión inválida.' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Sesión inválida o vencida.' }, 401);

  try {
    const body = await req.json();
    const action = text(body?.action);
    const userId = userData.user.id;

    if (action === 'getPublicKey') {
      await assertRole(admin, userId, 'delivery');
      const config = await getPushConfig(admin);
      return json({ publicKey: config.vapid_public_key });
    }

    if (action === 'subscribe') {
      await assertRole(admin, userId, 'delivery');

      const subscription = body?.subscription;
      const endpoint = text(subscription?.endpoint);
      const p256dh = text(subscription?.keys?.p256dh);
      const authKey = text(subscription?.keys?.auth);

      if (!endpoint || !p256dh || !authKey) {
        return json({ error: 'La suscripción de notificaciones no es válida.' }, 400);
      }

      const stamp = new Date().toISOString();
      const { error } = await admin
        .from('delivery_push_subscriptions')
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth_key: authKey,
            user_agent: text(body?.userAgent).slice(0, 500) || null,
            updated_at: stamp,
            last_seen_at: stamp,
          },
          { onConflict: 'endpoint' },
        );

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'unsubscribe') {
      await assertRole(admin, userId, 'delivery');
      const endpoint = text(body?.endpoint);
      if (endpoint) {
        const { error } = await admin
          .from('delivery_push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', endpoint);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === 'testSelf') {
      await assertRole(admin, userId, 'delivery');
      const result = await sendPushToUser(admin, userId, {
        title: '🍔 Notificaciones funcionando',
        body: 'La Central Delivery puede enviarte avisos de nuevos pedidos.',
        tag: `delivery-push-test-${Date.now()}`,
        url: '/delivery',
      });
      return json({ ok: true, ...result });
    }

    if (action === 'notifyAssignment') {
      await assertRole(admin, userId, 'admin');
      const assignmentId = text(body?.assignmentId);
      if (!assignmentId) return json({ error: 'Falta la asignación.' }, 400);
      const result = await notifyAssignment(admin, assignmentId);
      return json({ ok: true, ...result });
    }

    return json({ error: 'Acción no soportada.' }, 400);
  } catch (error) {
    console.error('delivery-push:', error);
    return json(
      { error: error instanceof Error ? error.message : 'No se pudo completar la operación.' },
      400,
    );
  }
});

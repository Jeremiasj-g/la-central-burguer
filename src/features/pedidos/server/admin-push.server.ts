import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Sólo desde el servidor, después de guardar un pedido público.
 * La firma HMAC impide que cualquier visitante genere avisos falsos.
 * No se envía la clave privada de VAPID al navegador ni a la Edge Function.
 */
export async function notifyAdminNewOrder(orderId: string) {
  if (!uuidPattern.test(orderId)) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return;

  const supabase = getSupabaseAdminClient() as unknown as SupabaseClient;
  const { data, error } = await supabase
    .from('app_push_config')
    .select('vapid_private_key')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data?.vapid_private_key) {
    console.warn('[admin-push] Configuración privada de Push no disponible.');
    return;
  }

  const sentAt = Date.now();
  const signature = createHmac('sha256', data.vapid_private_key as string)
    .update(`lcb-admin-order:v1:${orderId}:${sentAt}`)
    .digest('hex');

  const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/admin-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'notifyNewOrder', orderId, sentAt, signature }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    console.error('[admin-push] Error del envío:', response.status, await response.text().then(v => v.slice(0, 250)));
    return;
  }
  const result = await response.json() as { ok?: boolean; sent?: number; failed?: number };
  console.info('[admin-push] Aviso procesado.', { sent: result.sent ?? 0, failed: result.failed ?? 0 });
}

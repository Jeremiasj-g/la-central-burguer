// Verificación CI temporal de notificaciones Admin.
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type PushResponse = {
  ok?: boolean;
  publicKey?: string;
  sent?: number;
  failed?: number;
  subscriptionCount?: number;
  firstError?: string | null;
  error?: string;
};

export type AdminPushStatus = 'unsupported' | 'denied' | 'disabled' | 'enabled';

export function supportsAdminPush() {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function isIosAdminPushWithoutApp() {
  if (typeof window === 'undefined') return false;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const n = navigator as Navigator & { standalone?: boolean };
  return ios && !window.matchMedia('(display-mode: standalone)').matches && !n.standalone;
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const bytes = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const raw = new Uint8Array(new ArrayBuffer(bytes.length));
  for (let i = 0; i < bytes.length; i++) raw[i] = bytes.charCodeAt(i);
  return raw;
}

async function invokeAdminPush(body: Record<string, unknown>): Promise<PushResponse> {
  const { data, error } = await getSupabaseBrowserClient()
    .functions.invoke<PushResponse>('admin-push', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

export async function registerAdminPushWorker() {
  if (!supportsAdminPush()) return null;
  return navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin/' });
}

export async function getAdminPushStatus(): Promise<AdminPushStatus> {
  if (!supportsAdminPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (isIosAdminPushWithoutApp()) return 'unsupported';
  const worker = await registerAdminPushWorker();
  if (!worker) return 'unsupported';
  const sub = await worker.pushManager.getSubscription();
  if (!sub) return 'disabled';

  // El permiso Web Push puede seguir activo después de que el servidor quite
  // el dispositivo. Renovar su presencia sólo cuando el usuario está logueado.
  try {
    await invokeAdminPush({ action: 'subscribe', subscription: sub.toJSON(), userAgent: navigator.userAgent });
    return 'enabled';
  } catch {
    return 'disabled';
  }
}

export async function enableAdminPush() {
  if (!supportsAdminPush()) throw new Error('Este navegador no admite notificaciones Push.');
  if (isIosAdminPushWithoutApp()) {
    throw new Error('En iPhone, primero instalá La Central Admin desde Safari.');
  }

  const registration = await registerAdminPushWorker();
  if (!registration) throw new Error('No se pudo registrar la app de administración.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Las notificaciones están bloqueadas en el navegador.'
      : 'No se autorizó el envío de notificaciones.');
  }
  const info = await invokeAdminPush({ action: 'getPublicKey' });
  const publicKey = info.publicKey?.trim();
  if (!publicKey) throw new Error('No se encontró la clave pública de notificaciones.');

  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await invokeAdminPush({ action: 'subscribe', subscription: sub.toJSON(), userAgent: navigator.userAgent });
  return true;
}

export async function testAdminPush() {
  return invokeAdminPush({ action: 'testSelf' });
}

export async function disableAdminPush() {
  if (!supportsAdminPush()) return;
  const worker = await navigator.serviceWorker.getRegistration('/admin/');
  const sub = await worker?.pushManager.getSubscription();
  if (!sub) return;
  await invokeAdminPush({ action: 'unsubscribe', endpoint: sub.endpoint });
  await sub.unsubscribe();
}

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function updateAdminAppBadge(count: number) {
  if (typeof navigator === 'undefined') return;
  const badge = navigator as NavigatorWithBadge;
  const result = count > 0
    ? badge.setAppBadge?.(Math.min(99, count))
    : badge.clearAppBadge?.();
  void result?.catch(() => {});
}

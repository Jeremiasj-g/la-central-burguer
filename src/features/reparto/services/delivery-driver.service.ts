import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';
import type {
  DeliveryAssignmentStatus,
  DeliveryDriverDashboard,
  DeliveryDriverDeliveryDetail,
} from '../types/delivery-management.types';

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

type DeliveryRouteMetadata = {
  orderId: string;
  routeDistanceKm: number | null;
  straightDistanceKm: number | null;
  routeDurationSeconds: number | null;
  routeProvider: string | null;
  travelMode: string | null;
  routeVia: string | null;
  routeQuotedAt: string | null;
};

type DeliveryPushResponse = {
  publicKey?: string;
  ok?: boolean;
  sent?: number;
  failed?: number;
  subscriptionCount?: number;
  firstError?: string | null;
  error?: string;
};

export type DeliveryPushTestResult = {
  sent: number;
  failed: number;
  subscriptionCount: number;
  firstError: string | null;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function invokeDeliveryPush(body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke<DeliveryPushResponse>('delivery-push', { body });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export function supportsDeliveryPush() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerDeliveryServiceWorker() {
  if (!supportsDeliveryPush()) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/delivery/' });
}

export async function getDeliveryPushStatus() {
  if (!supportsDeliveryPush()) return 'unsupported' as const;
  const registration = await registerDeliveryServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  if (Notification.permission === 'denied') return 'denied' as const;
  return subscription ? 'enabled' as const : 'disabled' as const;
}

export async function enableDeliveryPushNotifications() {
  if (!supportsDeliveryPush()) {
    throw new Error('Este navegador no admite notificaciones push.');
  }

  const registration = await registerDeliveryServiceWorker();
  if (!registration) throw new Error('No se pudo preparar el dispositivo para notificaciones.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Las notificaciones están bloqueadas para este sitio.'
      : 'No se habilitaron las notificaciones.');
  }

  const response = await invokeDeliveryPush({ action: 'getPublicKey' });
  const publicKey = response?.publicKey?.trim();
  if (!publicKey) throw new Error('No se pudo obtener la clave de notificaciones.');

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const serialized = subscription.toJSON();
  await invokeDeliveryPush({
    action: 'subscribe',
    subscription: serialized,
    userAgent: navigator.userAgent,
  });

  return true;
}

export async function disableDeliveryPushNotifications() {
  if (!supportsDeliveryPush()) return;
  const registration = await navigator.serviceWorker.getRegistration('/delivery/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await invokeDeliveryPush({
    action: 'unsubscribe',
    endpoint: subscription.endpoint,
  });

  await subscription.unsubscribe();
}

export async function testDeliveryPushNotification(): Promise<DeliveryPushTestResult> {
  const data = await invokeDeliveryPush({ action: 'testSelf' });
  return {
    sent: data?.sent ?? 0,
    failed: data?.failed ?? 0,
    subscriptionCount: data?.subscriptionCount ?? 0,
    firstError: data?.firstError ?? null,
  };
}

function client() {
  requireSupabaseConfigured('usar el panel de repartidor');
  return getSupabaseBrowserClient();
}

async function deliveryRpc<T>(name: string, args?: Record<string, unknown>) {
  const supabase = client();
  const invoke = supabase.rpc.bind(supabase) as unknown as RpcInvoker;
  const { data, error } = await invoke<T>(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function getAccessContext() {
  return deliveryRpc<AccessContext>('get_current_access_context');
}

async function getRouteMetadata(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, DeliveryRouteMetadata>();

  const rows = await deliveryRpc<DeliveryRouteMetadata[]>(
    'get_delivery_driver_route_metadata',
    { order_ids: orderIds },
  );

  return new Map((rows ?? []).map((row) => [row.orderId, row]));
}

function mergeRouteMetadata<T extends {
  orderId: string;
  distanceKm: number | null;
}>(item: T, metadata: DeliveryRouteMetadata | undefined): T & DeliveryRouteMetadata {
  const fallback: DeliveryRouteMetadata = {
    orderId: item.orderId,
    routeDistanceKm: item.distanceKm,
    straightDistanceKm: null,
    routeDurationSeconds: null,
    routeProvider: null,
    travelMode: null,
    routeVia: null,
    routeQuotedAt: null,
  };

  const route = metadata ?? fallback;
  return {
    ...item,
    ...route,
    distanceKm: route.routeDistanceKm ?? item.distanceKm,
  };
}

export async function loginDeliveryDriver(email: string, password: string) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message);
  }
  if (!data.user) throw new Error('No se pudo validar el usuario.');

  try {
    const access = await getAccessContext();
    if (!access?.active || !access.roles.includes('delivery')) throw new Error('Sin rol de delivery.');
    await deliveryRpc<DeliveryDriverDashboard>('get_delivery_driver_dashboard');
  } catch {
    await supabase.auth.signOut();
    throw new Error('Este usuario no tiene acceso al panel de reparto.');
  }
}

export async function isDeliveryDriverLoggedIn() {
  const supabase = client();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  try {
    const access = await getAccessContext();
    return Boolean(access?.active && access.roles.includes('delivery'));
  } catch {
    return false;
  }
}

export async function logoutDeliveryDriver() {
  const { error } = await client().auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getDeliveryDriverDashboard(): Promise<DeliveryDriverDashboard> {
  const data = await deliveryRpc<DeliveryDriverDashboard>('get_delivery_driver_dashboard');
  if (!data) throw new Error('El panel de reparto no devolvió información.');

  const metadata = await getRouteMetadata(data.activeAssignments.map((item) => item.orderId));

  return {
    ...data,
    activeAssignments: data.activeAssignments.map((item) =>
      mergeRouteMetadata(item, metadata.get(item.orderId))),
  };
}

export async function getDeliveryDriverDeliveryDetail(assignmentId: string): Promise<DeliveryDriverDeliveryDetail> {
  const data = await deliveryRpc<DeliveryDriverDeliveryDetail>('get_delivery_driver_delivery_detail', {
    assignment_uuid: assignmentId,
  });
  if (!data) throw new Error('No se pudo obtener el detalle de la entrega.');

  const metadata = await getRouteMetadata([data.orderId]);
  return mergeRouteMetadata(data, metadata.get(data.orderId));
}

export async function advanceDeliveryAssignment(
  assignmentId: string,
  nextStatus: DeliveryAssignmentStatus,
  note?: string,
) {
  await deliveryRpc<unknown>('driver_advance_delivery', {
    assignment_uuid: assignmentId,
    next_status: nextStatus,
    note: note?.trim() || null,
  });
}

export async function rejectDeliveryAssignment(assignmentId: string, reason: string) {
  await deliveryRpc<unknown>('driver_reject_delivery', {
    assignment_uuid: assignmentId,
    reason: reason.trim() || 'Cliente rechazó el pedido',
  });
}

const subscribeDriverDeliveryRealtime = createSharedRealtimeSubscription(
  'delivery-driver-feed',
  (channel, notifyListeners) =>
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_assignments' },
        notifyListeners,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delivery_assignment_compensation' },
        notifyListeners,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        notifyListeners,
      ),
);

export function subscribeToDriverDeliveries(onChange: () => void): () => undefined {
  const unsubscribe = subscribeDriverDeliveryRealtime(onChange);
  return () => {
    unsubscribe();
    return undefined;
  };
}

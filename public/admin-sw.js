/* Web Push de La Central Admin. Scope exclusivo /admin/.
   No guarda ni cachea datos privados. Delivery conserva /sw.js. */
const ICON = '/api/pwa/icon/192';
const BADGE = '/api/pwa/icon/192';
const ORDER_PATH = '/admin/pedidos';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* Siempre utiliza la red. */ });

function safeDestination(value) {
  try {
    const url = new URL(value || ORDER_PATH, self.location.origin);
    return url.origin === self.location.origin && url.pathname.startsWith('/admin/')
      ? url.href : new URL(ORDER_PATH, self.location.origin).href;
  } catch {
    return new URL(ORDER_PATH, self.location.origin).href;
  }
}

self.addEventListener('push', (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; }
  catch { message = { body: event.data?.text() ?? '' }; }

  event.waitUntil((async () => {
    const badgeCount = Number(message.badgeCount);
    if (Number.isFinite(badgeCount) && badgeCount >= 0) {
      try {
        if (badgeCount > 0 && self.navigator?.setAppBadge) {
          await self.navigator.setAppBadge(Math.min(99, badgeCount));
        } else if (badgeCount === 0 && self.navigator?.clearAppBadge) {
          await self.navigator.clearAppBadge();
        }
      } catch { /* El sistema operativo puede no soportar badges. */ }
    }
    await Promise.all([
      self.registration.showNotification(message.title || 'La Central Burger Admin', {
        body: message.body || 'Ingresó un nuevo pedido.',
        icon: ICON,
        badge: BADGE,
        tag: message.tag || 'admin-new-order',
        renotify: true,
        vibrate: [210, 80, 210],
        timestamp: Date.now(),
        data: { url: safeDestination(message.url), orderId: message.orderId ?? null },
      }),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
        for (const win of windows) win.postMessage({
          type: 'ADMIN_PUSH_RECEIVED',
          orderId: message.orderId ?? null,
        });
      }),
    ]);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destination = safeDestination(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const adminWindow = windows.find((win) => {
      try { return new URL(win.url).pathname.startsWith('/admin/'); } catch { return false; }
    });
    if (adminWindow) {
      await adminWindow.navigate(destination);
      await adminWindow.focus();
    } else if (self.clients.openWindow) {
      await self.clients.openWindow(destination);
    }
  })());
});

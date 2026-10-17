const DELIVERY_ICON = '/api/pwa/icon/192';

function deliveryNotificationOptions(data = {}) {
  return {
    body: data.body || 'Tenés una nueva actualización.',
    icon: DELIVERY_ICON,
    badge: DELIVERY_ICON,
    tag: data.tag || 'central-delivery',
    renotify: true,
    silent: false,
    vibrate: [220, 90, 220],
    timestamp: Date.now(),
    data: {
      url: data.url || '/delivery',
      assignmentId: data.assignmentId || null,
    },
  };
}

async function showDeliveryNotification(data = {}) {
  const title = data.title || 'La Central Burger';
  await self.registration.showNotification(title, deliveryNotificationOptions(data));
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // La navegación sigue usando la red; este worker se ocupa del ciclo PWA y Web Push.
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    Promise.all([
      showDeliveryNotification(data),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'DELIVERY_PUSH_RECEIVED',
            assignmentId: data.assignmentId || null,
          });
        });
      }),
    ]),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_DELIVERY_NOTIFICATION') return;

  event.waitUntil(
    showDeliveryNotification({
      title: event.data.title,
      body: event.data.body,
      tag: event.data.tag,
      url: event.data.url,
      assignmentId: event.data.assignmentId,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/delivery', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    }),
  );
});

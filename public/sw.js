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

  const title = data.title || 'La Central Burger';
  const options = {
    body: data.body || 'Tenés una nueva actualización.',
    icon: '/icons/burger-delivery.svg',
    badge: '/icons/burger-delivery.svg',
    tag: data.tag || 'central-delivery',
    renotify: true,
    silent: false,
    vibrate: [180, 80, 180],
    timestamp: Date.now(),
    data: {
      url: data.url || '/delivery',
      assignmentId: data.assignmentId || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
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

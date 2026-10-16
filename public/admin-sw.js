/* Service worker exclusivo de /admin/.
   No almacena solicitudes, autenticación ni respuestas privadas.
   Delivery conserva su propio /sw.js y su suscripción Push. */
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', () => {
  // Red obligatoria: no implementar caché de pedidos, clientes ni sesiones.
});

/**
 * Datos persistentes antiguos usados cuando el proyecto funcionaba con mocks.
 *
 * La versión conectada a Supabase usa la base como única fuente de verdad para
 * administración, catálogo, configuración, ventas y pedidos. Solo se conservan
 * en localStorage los datos temporales del cliente: carrito y borrador del checkout.
 */
const LEGACY_PERSISTENCE_KEYS = [
  'central_orders',
  'central_order_notifications_seen',
  'central_admin_session',
  'central_products_v2',
  'central_categories_v2',
  'central_ingredients',
  'central_recipes',
  'central_business_config',
] as const;

export function clearLegacyPersistence() {
  if (typeof window === 'undefined') return;

  for (const key of LEGACY_PERSISTENCE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

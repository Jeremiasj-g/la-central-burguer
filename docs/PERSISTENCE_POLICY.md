# Política de persistencia

## Fuente de verdad

Supabase es la única fuente de verdad para datos compartidos o administrativos:

- usuarios y sesiones administrativas;
- configuración del negocio;
- productos, categorías, ingredientes y recetas;
- pedidos, clientes e ítems;
- historial de estados;
- notificaciones vistas;
- ventas y dashboard.

Si Supabase no está configurado, estas funciones muestran un error explícito. No se cargan datos ficticios ni se crean pedidos locales que parezcan reales.

## Datos temporales del cliente

El navegador conserva solamente lo necesario para que el cliente no pierda un pedido en preparación:

- `central_cart`: carrito, cantidades y aclaraciones por producto;
- `central_checkout_draft_v1`: datos aún no confirmados del checkout.

El borrador del checkout vence después de 24 horas. Ambos se limpian al confirmar correctamente el pedido en Supabase.

## Migración desde versiones anteriores

Al iniciar la aplicación se eliminan automáticamente las claves antiguas que podían contener datos mock del panel. Esta limpieza no borra el carrito ni el borrador del checkout.

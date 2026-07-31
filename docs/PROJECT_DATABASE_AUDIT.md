# Auditoría funcional y trazabilidad a Supabase

## Sitio público

### Home

`BurgerHero`, `PublicHeader` y `PublicFooter` consumen `business_config` mediante `useBusinessConfig()`:

- nombre;
- descripción;
- WhatsApp;
- dirección;
- especialidad;
- estado abierto/cerrado.

La suscripción Realtime actualiza esos datos cuando el administrador guarda cambios.

### Menú y categorías

`OrderingMenuSection` obtiene categorías y productos mediante hooks/services. Supabase aporta `categories`, `products` y `product_ingredients`. La búsqueda y el filtro trabajan sobre datos de dominio; el cambio de fuente no altera la UI.

### Detalle de producto

`ProductDetailModal` utiliza el producto vigente, cantidad y aclaración. La aclaración no modifica el producto: se almacena en el ítem temporal del carrito y finalmente en `order_items.note`.

### Carrito

El carrito permanece en `localStorage` porque es un borrador del navegador, no un pedido. Permite cantidades, eliminación y edición de aclaraciones. Al confirmar se convierte en una transacción real de Supabase. Se sanitizan imágenes base64 para evitar exceder la cuota del navegador.

### Checkout y ubicación

`CheckoutModal` lee configuración y métodos de pago. La Geolocation API se solicita solamente desde el navegador. `delivery.service` llama siempre a `calculate_delivery_quote()` en Supabase. La dirección escrita deja de ser obligatoria cuando existe GPS. El formulario aún no confirmado se conserva en `central_checkout_draft_v1`, vence después de 24 horas y se elimina después de crear correctamente el pedido.

### Confirmación y WhatsApp

`create_public_order()` guarda primero el pedido. Después `buildWhatsappUrl()` usa el pedido persistido y la configuración vigente. Incluye código, cliente, entrega, GPS/Maps, distancia, productos, aclaraciones, observaciones y datos de transferencia.

## Panel administrativo

### Autenticación

`AdminLoginPage` usa Supabase Auth. `AdminShell` recupera la sesión y valida `profiles.role = admin` y `active = true`. RLS repite la autorización en PostgreSQL; ocultar pantallas no es la única seguridad.

### Campana

`AdminNotifications` escucha `orders` por Realtime. `order_notification_reads` persiste vistos por administrador. Las tarjetas diferencian nuevos/vistos y enlazan a Pedidos.

### Dashboard

`DashboardPage` consume `get_dashboard_stats()` y visualiza:

- Ventas del día;
- Total pedidos;
- Pedidos cancelados;
- Ticket promedio;
- Evolución semanal;
- Ingresos por día;
- Productos más vendidos;
- Ventas por categoría;
- Métodos de pago;
- Delivery vs retiro;
- Promociones más vendidas;
- Horarios con mayor cantidad de pedidos;
- Últimos pedidos.

### Productos

CRUD sobre `products`; imagen subida a `product-images`; chips asociados en `product_ingredients` mediante una RPC transaccional. El precio es manual. Los productos de la categoría `Promos` quedan marcados como promoción para alimentar el gráfico correspondiente. Activo, disponible, destacado y promoción son campos separados. Eliminar realiza baja lógica para no romper pedidos históricos.

### Categorías

CRUD sobre `categories`, con nombre, descripción, orden y estado. Una categoría con productos vigentes no puede eliminarse; debe desactivarse o mover sus productos.

### Ingredientes

CRUD sobre `ingredients`, sin costos. Los ingredientes activos alimentan inmediatamente los chips de Producto. Un ingrediente asociado no puede eliminarse; puede desactivarse.

### Recetas / composición

`RecetasAdminPage` busca un producto y lee `product_ingredients`. Las cantidades conocidas se guardan; el resto queda “A definir”. La versión actual no calcula costos ni precios sugeridos.

### Pedidos

`PedidosAdminPage` consulta `orders`, `order_items` y `order_status_history`. Los pedidos web nacen `aceptado`. La acción disponible actualmente es cancelar si el cliente cancela por WhatsApp. Dirección, Maps, distancia, entrega, pago, total y aclaraciones quedan persistidos.

### Ventas

`VentasAdminPage` consulta `sales_ledger`, que excluye cancelados. Permite búsqueda y filtros por entrega y método de pago. No es todavía el módulo futuro de reportes/exportaciones.

### Configuración

`ConfiguracionAdminPage` actualiza `business_config` y `payment_methods`. Los cambios llegan al Home, footer, header, checkout, delivery y WhatsApp. El cierre automático usa un horario global, exactamente como la UI actual.

## Estado que deliberadamente NO va a la base

- Carrito sin confirmar.
- Búsqueda/categoría seleccionada.
- Apertura de modales/drawers.
- Toasts.
- Permiso de geolocalización.
- Coordenadas antes de confirmar el pedido.
- Datos de formulario sin guardar.

Persistir esos estados sería contraproducente: son temporales, privados del dispositivo o puramente visuales.

## Historial y consistencia

Pedidos e ítems guardan snapshots. Una modificación futura del nombre, imagen, categoría o precio del producto no cambia pedidos anteriores. Las relaciones de catálogo usan baja lógica y las tablas de pedido conservan referencias opcionales/snapshots.

## Fallback de desarrollo

Supabase es obligatorio para todos los datos persistentes del negocio y del panel. Los services lanzan un error claro si faltan variables. localStorage queda limitado al carrito y al borrador del checkout; componentes y páginas no importan el cliente de base de datos directamente.

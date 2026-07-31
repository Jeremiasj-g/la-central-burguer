# Modelo de datos definitivo — La Central Burger

Este modelo representa únicamente las funciones que existen en la aplicación actual y la persistencia necesaria para que el sitio público y todo el panel administrativo compartan los mismos datos. No incorpora precios sugeridos, costos automáticos de ingredientes, stock, caja ni reportes exportables porque esos módulos no forman parte de la versión actual.

## Identidad y seguridad

### `profiles`
Extiende `auth.users` sin duplicar credenciales. Guarda nombre visible, rol (`admin` o `staff`) y estado. El panel actual permite ingresar únicamente a perfiles `admin` activos.

## Configuración del negocio

### `business_config`
Tabla singleton (`id = 1`) utilizada por Home, header, footer, checkout, WhatsApp y Configuración. Persiste:

- nombre del negocio;
- URL pública y ruta interna del logo editable;
- descripción del hero;
- WhatsApp receptor de pedidos;
- alias y CVU/CBU;
- dirección y especialidad;
- zona horaria;
- apertura manual;
- automatización con hora global de apertura/cierre;
- coordenadas del local;
- tarifa base, precio por kilómetro, radio máximo y redondeo de delivery.

### `payment_methods`
Contiene los dos códigos soportados por el checkout (`efectivo` y `transferencia`), con nombre editable, orden y estado. Desactivar un método lo quita del checkout y la función de creación de pedidos rechaza cualquier método deshabilitado.

## Catálogo

### `categories`
Nombre, slug, descripción, icono, imagen opcional, orden, estado y baja lógica. El orden alimenta los tabs públicos y la tabla administrativa. Una categoría inactiva oculta también sus productos del catálogo público y bloquea pedidos nuevos de esos productos.

### `products`
Producto vendible con categoría, nombre, descripción, imagen, precio manual, estado activo, disponibilidad, destacado, indicador de promoción, orden y baja lógica.

### `ingredients`
Catálogo de ingredientes utilizado por el selector de chips del alta/edición de productos y por la vista de composición. Guarda tipo, unidad, proveedor, estado y fecha de actualización. No contiene precios ni cálculos automáticos.

### `product_ingredients`
Relación muchos-a-muchos entre productos e ingredientes. Admite cantidad y unidad cuando estén definidas; cuando todavía no se conoce la cantidad, se conserva `NULL` y el panel muestra “A definir”. La sincronización completa se realiza con la RPC administrativa `sync_product_ingredients()`, de forma transaccional.

## Clientes, pedidos y ventas

### `customers`
Consolida clientes por teléfono normalizado. Guarda sus últimos datos de contacto/entrega, cantidad de pedidos y fecha del último pedido. No requiere una cuenta ni login del cliente.

### `orders`
Cabecera de cada pedido. Guarda snapshots de cliente, modalidad de entrega, dirección, GPS, distancia, Maps, método de pago, subtotal, envío, total generado, estado, observaciones y fechas de aceptación/cancelación.

### `order_items`
Detalle inmutable del pedido: producto, categoría, imagen, indicador de promoción, cantidad, precio unitario, total y aclaración. Los snapshots preservan la historia aunque el producto sea editado o eliminado después.

### `order_status_history`
Timeline automático de creación y cambios de estado.

### `order_notification_reads`
Relaciona cada administrador con los pedidos que ya vio en la campana. Así el badge de “nuevos” no depende del navegador ni se comparte incorrectamente entre administradores.

### `sales_ledger`
Vista de pedidos no cancelados utilizada por `/admin/ventas`. Expone entrega, pago, importes y fechas sin duplicar datos.

## Auditoría

### `audit_logs`
Registra altas, modificaciones y eliminaciones administrativas sobre configuración, métodos de pago, categorías, productos, ingredientes, composiciones y pedidos. Guarda usuario, acción, tabla y valores anterior/nuevo.

## Funciones de base de datos

### `is_business_open()`
Evalúa apertura manual o el intervalo automático, incluyendo horarios que cruzan medianoche.

### `distance_km()`
Calcula distancia en línea recta con Haversine.

### `calculate_delivery_quote()`
Devuelve distancia, costo estimado redondeado, estado dentro/fuera de radio y URL de Google Maps.

### `create_public_order(payload)`
Transacción pública segura:

1. verifica que el local esté abierto;
2. valida cliente, entrega y método de pago habilitado;
3. vuelve a consultar productos activos/disponibles;
4. recalcula los precios desde PostgreSQL;
5. calcula delivery cuando hay GPS;
6. actualiza/crea el cliente;
7. crea cabecera, ítems e historial;
8. devuelve el pedido completo para armar WhatsApp.

El navegador no puede insertar directamente en `orders` ni definir un precio arbitrario.

### `get_dashboard_stats(days_back)`
Entrega en una sola respuesta las métricas y series del dashboard: ventas del día, total de pedidos, cancelados, ticket promedio, evolución, ingresos, productos, categorías, promociones, medios de pago, delivery/retiro, horarios y últimos pedidos.

## Storage

### Bucket `product-images`
Bucket público para imágenes mostradas en el menú. Solo administradores activos pueden subir, reemplazar o eliminar archivos. Límite SQL inicial: 3 MB y formatos PNG, JPEG, WebP o GIF.

### Bucket `business-assets`
Bucket público para el logo institucional. Solo administradores activos pueden subir, reemplazar o eliminar archivos. El logo se referencia desde `business_config.logo_url` y se muestra en hero, navbar, footer y panel. Límite: 2 MB; formatos PNG, JPEG o WebP.

## Realtime

Se publican cambios de:

- `orders`;
- `products`;
- `categories`;
- `ingredients`;
- `product_ingredients`;
- `business_config`;
- `payment_methods`.

Esto sincroniza campana, menú, composición y configuración sin recargar la página completa.

## Integridad adicional

- Los índices únicos de categorías, ingredientes y productos son parciales (`deleted_at IS NULL`), de modo que la baja lógica no impide reutilizar un nombre.
- La creación pública limita tamaño de campos, cantidad de líneas y unidades por producto.
- Los productos y categorías del carrito se bloquean durante la transacción para conservar precio/disponibilidad mientras se crean la cabecera y los ítems.
- Las imágenes reemplazadas o eliminadas se limpian del bucket cuando corresponde.

# Análisis integral del proyecto — La Central Burger

## 1. Alcance actual

La aplicación es un sistema web de pedidos para una hamburguesería con dos superficies:

1. **Sitio público:** identidad del negocio, menú filtrable, carrito, checkout, ubicación GPS, estimación de delivery y envío del detalle por WhatsApp.
2. **Panel administrativo:** autenticación, notificaciones, dashboard, CRUD de catálogo, composición de productos, pedidos, ventas y configuración.

La arquitectura conserva el flujo aprobado:

```txt
Página / componente
→ hook
→ service
→ Supabase en producción
→ Supabase como fuente de verdad; si faltan variables se muestra un error de configuración
```

Los componentes visuales no consultan Supabase directamente.

---

## 2. Rutas de Next.js

### Públicas

| Ruta | Página de feature | Responsabilidad |
|---|---|---|
| `/` | `HomePage` | Hero, estado del local, identidad y acceso al menú. |
| `/menu` | `CatalogoPage` | Menú completo, categorías, búsqueda, carrito y checkout. |

### Administración

| Ruta | Página de feature | Responsabilidad |
|---|---|---|
| `/admin/login` | `AdminLoginPage` | Login de administrador. |
| `/admin/dashboard` | `DashboardPage` | Métricas, gráficos y últimos pedidos. |
| `/admin/productos` | `ProductosAdminPage` | CRUD, imágenes, precio, estados e ingredientes. |
| `/admin/categorias` | `CategoriasAdminPage` | CRUD, orden y estado de categorías. |
| `/admin/ingredientes` | `IngredientesAdminPage` | CRUD de ingredientes usados en chips/recetas. |
| `/admin/recetas` | `RecetasAdminPage` | Búsqueda y composición producto–ingrediente. |
| `/admin/pedidos` | `PedidosAdminPage` | Consulta, filtros, detalle y cancelación. |
| `/admin/ventas` | `VentasAdminPage` | Libro de ventas no canceladas. |
| `/admin/configuracion` | `ConfiguracionAdminPage` | Datos del negocio, pago, horarios y delivery. |

`src/app` se mantiene como capa de rutas. La lógica vive en `src/features`.

---

## 3. Layout y providers compartidos

### `AppProviders`

Monta una sola instancia global de React-Toastify. Todos los mensajes de éxito, advertencia y error utilizan ese contenedor.

### `PublicShell`

Envuelve el sitio público con header, contenido y footer.

### `PublicHeader`

- Lee el nombre desde `business_config`.
- Contiene navegación desktop/mobile.
- Es sticky.
- No contiene lógica de catálogo ni pedidos.

### `PublicFooter`

- Lee nombre, dirección y WhatsApp desde `business_config`.
- El enlace de WhatsApp se actualiza con Configuración.
- Conserva identidad, contacto y créditos.

### `AdminShell`

- Verifica sesión antes de renderizar el panel.
- Redirige al login cuando no hay administrador válido.
- Contiene sidebar, header sticky, campana y enlace al sitio.
- Muestra el nombre configurado del negocio.
- Gestiona logout y navegación mobile.

### `AdminNotifications`

- Lee últimos pedidos.
- Escucha `orders` por Realtime.
- Recupera vistos desde `order_notification_reads`.
- Distingue “Nuevo” de “Visto”.
- Permite marcar todos como vistos.
- Enlaza a Gestión de pedidos.

### Componentes UI

- `Modal`: portal a `document.body`, altura con `dvh`, foco/teclado mobile y tema claro/oscuro.
- `ConfirmDialog`: confirmación consistente antes de acciones destructivas o persistentes.
- `Drawer`: carrito mobile.
- `Button`, `Input`, `Textarea`, `Select`, `Badge`, `TableShell`, `Card`, `EmptyState`: sistema compartido de controles.
- `GlobalPageSkeleton`: fallback de rutas.

---

## 4. Home

### `HomePage`

Compone `BurgerHero` y el menú público.

### `BurgerHero`

Consume `useBusinessConfig()` y calcula estado abierto/cerrado con la misma regla visible en Configuración:

- modo manual: `isOpen`;
- modo automático: intervalo `autoOpenTime`–`autoCloseTime`;
- soporta cierre después de medianoche.

Visualiza:

- nombre del negocio;
- descripción editable;
- estado con borde verde/rojo;
- WhatsApp;
- dirección;
- especialidad.

### Persistencia

Todos esos datos viven en `business_config`. Realtime refresca la UI sin reconstruir el componente ni recargar la ruta.

---

## 5. Catálogo y menú

### `CatalogoPage`

Punto de composición de la experiencia pública.

### `OrderingMenuSection`

Coordina:

- `useCategorias()`;
- `useProductos()`;
- búsqueda;
- categoría activa;
- modal de detalle;
- carrito;
- checkout;
- panel sticky desktop;
- botón flotante mobile.

### `MenuSearchBar`

Mantiene el término de búsqueda. El filtrado se pasa al hook/service; no consulta datos directamente.

### `CategoryTabs`

- Usa Swiper para desplazamiento horizontal.
- Incluye “Todo”.
- Renderiza iconos según categoría.
- Mantiene accesibilidad de botones.

### `ProductoCard`

Muestra snapshot actual del producto:

- categoría;
- nombre;
- descripción;
- precio;
- imagen;
- destacado/promoción;
- estado cerrado/no disponible.

Si el local está cerrado, bloquea la selección y muestra feedback.

### `ProductDetailModal`

Permite:

- revisar imagen/descripción/precio;
- elegir cantidad;
- indicar si quiere aclaración;
- escribir la aclaración;
- agregar al carrito.

No modifica el producto. La aclaración pertenece al futuro ítem del pedido.

### Datos

- `categories`: tabs, orden y estado.
- `products`: cards y precio actual.
- `product_ingredients`: composición administrativa del producto, sincronizada transaccionalmente.
- `business_config`: estado del local.

---

## 6. Carrito

### `useCarrito`

Es la API de estado para la UI. Expone agregar, aumentar, disminuir, editar nota, eliminar y vaciar.

### `carrito.service`

Persiste el carrito en `localStorage` y calcula subtotal. El checkout mantiene además un borrador local separado con los datos aún no confirmados. Ambos son temporales y se eliminan cuando Supabase confirma el pedido.

### `CartSidebar`

- Panel desktop sticky dentro de la columna del menú.
- Conserva resumen mientras se recorre el catálogo.
- Abre checkout.

### `CartDrawer`

- Vista mobile con `dvh`.
- Total y confirmación permanecen visibles.
- Permite editar aclaraciones sin eliminar/reagregar el producto.

### `CartItemRow`

- Cantidad +/-.
- Eliminar con confirmación.
- Editar aclaración con guardar/cancelar.
- Si dos líneas quedan con mismo producto y misma nota, el service puede unificarlas.

### Persistencia final

El carrito no se copia tal cual a la base. `create_public_order()` consulta cada producto y genera `orders` + `order_items` con precios reales.

---

## 7. Checkout, delivery y WhatsApp

### `CheckoutModal`

Campos actuales:

- nombre obligatorio;
- teléfono obligatorio;
- delivery o retiro;
- dirección obligatoria solo sin GPS;
- ubicación actual opcional;
- método de pago activo;
- observaciones opcionales.

El resumen permanece sticky en escritorio. La confirmación final usa `ConfirmDialog`.

### `useCurrentLocation`

Solicita permiso al navegador y devuelve latitud/longitud. Ese permiso y las coordenadas previas al submit no se guardan en Supabase.

### `delivery.service`

- Con Supabase: RPC `calculate_delivery_quote`.
- Si Supabase no está configurado, no se calcula una tarifa ficticia y se informa el error de configuración.

### Regla de delivery

```txt
costo bruto = tarifa base + distancia × precio por km
costo estimado = redondeo hacia arriba configurado
```

Fuera de radio, el pedido puede enviarse con costo “A confirmar”, igual que la UX actual.

### `useCheckout`

Valida, crea el pedido, abre WhatsApp y expone la modal de agradecimiento/código.

### `checkout.service`

- En modo Supabase invoca `create_public_order`.
- El pedido confirmado se crea únicamente mediante la RPC transaccional de Supabase. El navegador conserva solo el carrito y el borrador previo al envío.
- Construye el mensaje de WhatsApp con el pedido ya persistido.

### Snapshots de pedido

El pedido conserva:

- nombre/teléfono del cliente;
- dirección/GPS/Maps/distancia;
- entrega y pago;
- nombre, categoría, imagen y precio de cada producto;
- cantidad y aclaración;
- subtotal, envío y total;
- observaciones.

---

## 8. Autenticación administrativa

### `AdminLoginPage`

Formulario visual con validación y toast.

### `auth.service`

- Usa `signInWithPassword` y luego consulta `profiles`.
- Rechaza perfiles no admin o inactivos.
- Si Supabase no está configurado, muestra un error y no habilita credenciales locales.

### Base de datos

- `auth.users`: credenciales y sesión.
- `profiles`: autorización de aplicación.
- trigger: crea perfil `staff` para cada usuario nuevo.
- `promote_admin.sql`: promoción explícita.

### Seguridad

El frontend verifica sesión para UX; las políticas RLS vuelven a validar el rol en cada operación.

---

## 9. Dashboard

### `useDashboardStats`

Carga y se suscribe a cambios de pedidos.

### `dashboard.service`

- Usa la RPC `get_dashboard_stats` como única fuente de datos.
- Si Supabase no está configurado, muestra un error en lugar de métricas ficticias.

### Componentes

- `DashboardMetricCard`: ventas del día, total pedidos, cancelados, ticket promedio.
- `SalesLineChart`: evolución semanal.
- `RevenueAreaChart`: ingresos diarios.
- `TopProductsBarChart`: productos más vendidos.
- `SalesByCategoryChart`: participación por categoría.
- `PaymentMethodsChart`: efectivo vs transferencia.
- `DeliveryMethodChart`: delivery vs retiro.
- `TopPromotionsBarChart`: promociones más vendidas.
- `SalesByHourChart`: demanda por hora.
- `RecentOrdersTable`: últimos pedidos.
- Skeletons específicos evitan pantallas vacías.

Todos los componentes Recharts reciben datos por props; los cálculos permanecen en PostgreSQL/service.

---

## 10. Productos

### Página y componentes

- `ProductosAdminPage`: filtros, modal, confirmaciones y toasts.
- `ProductoTable`: listado y acciones.
- `ProductoForm`: dos columnas, chips, imagen/vista previa, precio y estados.
- Skeletons para carga.

### Campos persistidos

- categoría;
- nombre;
- descripción combinada/manual;
- imagen;
- precio manual;
- activo;
- disponible;
- destacado;
- promoción;
- ingredientes;
- baja lógica.

### Imágenes

Los data URL seleccionados en el formulario se convierten a Blob y se suben a `product-images`. `products` guarda URL pública y ruta interna.

### Integridad

Eliminar no destruye el registro: marca `deleted_at`, `active = false`, `available = false`. Los pedidos históricos conservan sus snapshots.

---

## 11. Categorías

### Componentes

- `CategoriaForm`.
- `CategoriaTable`.
- Skeleton.
- `useCategorias` y mutaciones.

### Persistencia

`categories` almacena nombre, slug generado, descripción, orden, estado y baja lógica. El icono existente se conserva para los tabs aunque la UI actual no solicite editarlo.

### Integridad

No se permite baja lógica si aún tiene productos vigentes asociados.

---

## 12. Ingredientes

### Componentes

- `IngredienteForm`.
- `IngredienteTable`.
- Skeleton.
- hooks de consulta/mutación.

### Persistencia

`ingredients` contiene nombre, tipo, unidad, proveedor, estado y actualización. No guarda costos.

### Relación con Productos

Los ingredientes activos aparecen en los chips del formulario de Producto. La relación seleccionada se sincroniza en `product_ingredients`.

### Integridad

No se permite eliminar un ingrediente asociado. Puede desactivarse para ocultarlo de nuevas selecciones.

---

## 13. Recetas / composición

### `RecetasAdminPage`

- Combobox tipeable para buscar productos.
- Muestra ingredientes asociados.
- Cantidad y unidad cuando se conocen.
- “A definir” cuando solo existe la relación.

### `recetas.service`

Lee/escribe `product_ingredients`. Mantiene tipos de dominio `ProductRecipe` para que la UI no dependa de snake_case.

### Alcance actual

Es composición, no costeo. Los campos de composición no generan precios automáticos ni columnas de costeo en la base.

---

## 14. Pedidos

### `PedidosAdminPage`

- búsqueda por código, cliente o teléfono;
- filtro de estado;
- tabla responsive;
- detalle de productos y datos de entrega;
- Maps/distancia cuando existen;
- cancelación con confirmación.

### `pedidos.service`

- Hidrata cabeceras con ítems e historial.
- Escucha Realtime.
- Persiste vistos por admin.
- En producción, la creación pública solo se permite por RPC segura.

### Estado actual

Los pedidos web nacen `aceptado`. La interfaz actual permite pasar a `cancelado`. El enum conserva otros estados para no bloquear una futura ampliación, pero ninguna automatización los usa hoy.

---

## 15. Ventas

### `VentasAdminPage`

- tabla de ventas;
- búsqueda;
- filtros por delivery/retiro y efectivo/transferencia;
- importes y fechas.

### `sales_ledger`

Vista con `security_invoker` que excluye cancelados. No duplica ventas: cada venta es un pedido no cancelado.

### Límite de alcance

No incluye exportación Excel/PDF ni reportes avanzados. Esa funcionalidad sigue siendo un módulo comercial futuro.

---

## 16. Configuración

### Datos editables

- nombre;
- WhatsApp;
- alias;
- CVU/CBU;
- dirección;
- especialidad;
- descripción del hero.

### Delivery

- GPS del local;
- tarifa base;
- precio por km;
- radio máximo;
- redondeo.

### Pago

- nombre de Efectivo/Transferencia;
- habilitar/deshabilitar.

### Apertura

- estado manual;
- automatización;
- hora de apertura;
- hora de cierre.

### Propagación

Los cambios alimentan Home, header/footer, estado del menú, checkout, cálculo de delivery y mensaje de WhatsApp.

---

## 17. Correspondencia funcional → tablas

| Función | Tablas / recursos |
|---|---|
| Login admin | `auth.users`, `profiles` |
| Nombre/hero/contacto | `business_config` |
| Pago y transferencia | `payment_methods`, `business_config.transfer_*` |
| Horario/estado | `business_config`, `is_business_open()` |
| Costo de delivery | `business_config`, `calculate_delivery_quote()` |
| Categorías/tabs | `categories` |
| Productos/menu | `products` |
| Imágenes | Storage `product-images`, `products.image_*` |
| Chips/recetas | `ingredients`, `product_ingredients` |
| Cliente | `customers` |
| Pedido | `orders`, `order_items`, `order_status_history` |
| Campana | `orders`, `order_notification_reads`, Realtime |
| Dashboard | `orders`, `order_items`, RPC `get_dashboard_stats()` |
| Ventas | view `sales_ledger` |
| Auditoría | `audit_logs` |

---

## 18. Decisiones de seguridad e integridad

1. Los clientes no crean cuentas.
2. El carrito no se considera una venta.
3. El navegador nunca define el precio final persistido.
4. No hay permisos anónimos de escritura sobre tablas de pedidos.
5. La función pública es `SECURITY DEFINER`, con validaciones y `search_path` controlado.
6. RLS protege todas las tablas expuestas.
7. Storage solo permite escritura admin.
8. Bajas de catálogo son lógicas.
9. Pedidos conservan snapshots.
10. La campana persiste vistos por usuario.
11. Los datos de transferencia solo se envían en WhatsApp cuando corresponde.
12. Un método de pago deshabilitado se rechaza también en PostgreSQL.

---

## 19. Datos iniciales

`seed.sql` crea:

- configuración real inicial de La Central Burger;
- efectivo y transferencia;
- 10 categorías;
- 28 ingredientes;
- 61 productos;
- composiciones para los 61 productos;
- cantidades explícitas donde el catálogo inicial ya las tenía definidas;
- `NULL/A definir` donde todavía falta afinar la receta.

No crea pedidos, clientes, ventas ni notificaciones ficticias.

---

## 20. Funciones no implementadas deliberadamente

No se introdujeron tablas ni UI fantasma para:

- precios sugeridos;
- costos de ingredientes;
- stock/inventario;
- caja/apertura/cierre de caja;
- proveedores avanzados;
- usuarios clientes;
- promociones como entidad separada;
- exportaciones/reportes;
- delivery por rutas reales de calles;
- multi-sucursal.

Los productos promocionales actuales se representan con `products.is_promotion`, exactamente como el dashboard y el menú ya funcionan.

## 16. Controles de consistencia añadidos

- Una categoría desactivada oculta sus productos en `Todo` y en cualquier acceso público.
- La RPC de pedidos limita campos y líneas, valida métodos activos y usa precios vigentes de PostgreSQL.
- Producto y categoría se bloquean mientras se materializa el pedido para evitar diferencias entre subtotal e ítems.
- La baja lógica usa índices únicos parciales, por lo que un nombre eliminado puede volver a utilizarse.
- Las relaciones producto–ingrediente se reemplazan en una única transacción administrativa.
- Storage elimina imágenes anteriores al reemplazar o dar de baja un producto, evitando acumulación innecesaria.

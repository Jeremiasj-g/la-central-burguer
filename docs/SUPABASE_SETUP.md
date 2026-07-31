# Instalación de Supabase — La Central Burger

## 1. Crear el proyecto

1. Crear un proyecto vacío en Supabase.
2. Abrir **SQL Editor**.
3. Abrir `supabase/full_setup.sql`, copiarlo completo y ejecutarlo.
4. Confirmar que finalice sin errores.

El script crea esquema, tablas, índices, funciones, triggers, RLS, Storage, Realtime y el catálogo inicial. No agrega pedidos ficticios.


## Base ya instalada: habilitar logo editable

Si ya ejecutaste `full_setup.sql` antes de recibir esta versión, no vuelvas a crear la base. Ejecutá una sola vez en **SQL Editor**:

```txt
supabase/add_business_logo.sql
```

La migración agrega `business_config.logo_url`, `business_config.logo_path`, crea el bucket público `business-assets` y limita la escritura a administradores activos.

## 2. Crear el administrador

1. Ir a **Authentication → Users → Add user**.
2. Crear `gusdmeza@gmail.com` con la contraseña definitiva y confirmar el correo.
3. Ejecutar `supabase/promote_admin.sql` en SQL Editor.
4. Comprobar que el resultado muestre `role = admin` y `active = true`.

Los usuarios nuevos nacen como `staff`; nunca se promueven automáticamente a administrador.

## 3. Variables de entorno

Copiar `.env.example` como `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

Usar la URL y la publishable/anon key que muestra Supabase en **Connect**. No colocar la service role key en una variable `NEXT_PUBLIC_*`.

## 4. Instalar y ejecutar

```bash
npm install
npm run dev
```

La dependencia de Supabase se agregó al `package.json`; el primer `npm install` actualizará el lockfile local.

## 5. Verificación funcional

1. Entrar en `/admin/login` con el usuario creado.
2. Modificar nombre o descripción en Configuración y verificar el Home.
3. Crear/editar una categoría, ingrediente y producto.
4. Subir una imagen de producto y verificar el bucket `product-images`.
5. Subir el logo del negocio desde Configuración y verificar el bucket `business-assets`.
6. Abrir el local desde Configuración.
7. Crear un pedido desde `/menu`.
8. Confirmar que aparezca en Pedidos y en la campana sin recargar.
9. Marcarlo como visto y comprobar que el badge desaparezca.
10. Cancelarlo y verificar que no figure como venta.
11. Revisar Dashboard y Ventas.
12. Ejecutar `supabase/verification.sql` para comprobar tablas, funciones, Storage y Realtime.

## 6. Seguridad implementada

- Auth separado de `profiles`.
- Panel limitado a administradores activos.
- RLS en todas las tablas expuestas.
- Sin INSERT anónimo directo en pedidos/clientes/ítems.
- Pedido público mediante RPC atómica.
- Precios y disponibilidad recalculados en PostgreSQL.
- Método de pago validado contra la configuración activa.
- Imágenes editables solamente por administradores.
- Auditoría de cambios administrativos.

## 7. Realtime

La migración publica `orders`, `products`, `categories`, `ingredients`, `product_ingredients`, `business_config` y `payment_methods`. No hace falta activar manualmente esas tablas si `full_setup.sql` finalizó correctamente.

## 8. Desarrollo sin Supabase

Las variables son obligatorias. Si faltan, el proyecto no usa pedidos ni datos administrativos ficticios: muestra un error de configuración. localStorage continúa funcionando únicamente para el carrito y el borrador del checkout del cliente.

## 9. Archivos SQL

- `supabase/full_setup.sql`: recomendado para una instalación nueva.
- `supabase/migrations/202607310001_initial_schema.sql`: estructura inicial sin catálogo.
- `supabase/migrations/202607310002_business_logo.sql`: agrega logo editable y el bucket `business-assets` a una base ya instalada.
- `supabase/add_business_logo.sql`: copia directa de la migración anterior para ejecutar desde SQL Editor.
- `supabase/seed.sql`: configuración y catálogo inicial.
- `supabase/promote_admin.sql`: promoción controlada del primer administrador.
- `supabase/verification.sql`: auditoría de instalación de solo lectura.

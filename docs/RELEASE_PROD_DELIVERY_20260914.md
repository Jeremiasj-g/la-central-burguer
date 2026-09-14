# Release PROD · Delivery + RBAC + Invitaciones

Fecha de preparación: 2026-09-14

## Objetivo

Migrar `central-burguer-dev` a producción preservando todos los datos reales de `central-burguer` y evitando copiar datos de prueba de DEV.

Este release incluye:

- Módulo Delivery completo.
- RBAC normalizado (`roles`, `permissions`, `user_roles`, `role_permissions`).
- CRUD administrativo de usuarios y roles.
- Invitaciones por email y activación de cuenta.
- Comisión base por repartidor y override por pedido.
- Liquidaciones de delivery.
- Rechazo de pedido por el cliente.
- Realtime para asignaciones y cambios de estado.
- Dashboards y reportes actualizados.
- Ganancia bruta / neta después de comisiones liquidadas de delivery.
- Hardening de permisos `EXECUTE` para funciones sensibles.

## Baseline PROD previo al release

Tomado antes de cualquier cambio estructural:

- `orders`: 90
- `customers`: 76
- `products`: 66
- `categories`: 10
- `ingredients`: 28
- `order_items`: 120
- `product_ingredients`: 144
- `profiles`: 1
- `audit_logs`: 1357
- `order_notification_reads`: 8

Administrador real existente:

- Email: `gusdmeza@gmail.com`
- Rol legacy: `admin`
- Perfil activo: sí
- Email confirmado: sí

Estos valores sirven como control de integridad. Las migraciones del release no deben reemplazar ni importar pedidos, clientes, productos ni usuarios desde DEV.

## Datos que SÍ migran

Sólo estructura y datos de sistema:

- Tipos/enums necesarios para Delivery.
- Tablas Delivery.
- Tablas RBAC.
- Roles de sistema: `admin`, `staff`, `delivery`.
- Catálogo de permisos del sistema.
- Relación rol/permisos del sistema.
- Migración del usuario administrador real desde `profiles.role = admin` hacia `user_roles`.
- Funciones/RPC.
- Triggers.
- RLS y grants.
- Índices.
- Publicaciones Realtime.

## Datos que NO migran desde DEV

No copiar:

- `auth.users` de DEV.
- `profiles` de prueba.
- Repartidores de prueba.
- `user_roles` de usuarios de prueba.
- Pedidos de prueba.
- Clientes de prueba.
- Asignaciones de delivery de prueba.
- Eventos de reparto de prueba.
- Liquidaciones de prueba.
- Historiales operativos de DEV.

## Orden de migraciones de base de datos

Aplicar sobre `central-burguer` PROD en este orden:

1. `20260912143000_add_delivery_role.sql`
2. `20260912143100_delivery_module_core.sql`
3. `20260912143200_delivery_fk_indexes.sql`
4. `20260912143300_normalize_delivery_3nf.sql`
5. `20260912150000_rbac_access_management.sql`
6. `20260912150100_delivery_dashboard_rbac.sql`
7. `20260912153100_delivery_assignment_compensation.sql`
8. `20260913161000_auth_invites_start_inactive.sql`
9. `20260913214000_delivery_customer_rejection_status.sql`
10. `20260913214100_delivery_rejection_and_realtime.sql`
11. `20260913231500_delivery_history_detail.sql`
12. `20260914050000_harden_function_execution_grants.sql`

`20260910202734_require_gps_delivery_and_final_price.sql` ya existe en PROD.

`dashboard_revenue_breakdown` también ya fue aplicado en PROD con una versión de historial distinta (`20260912141027`), por lo que no es necesario volver a ejecutarlo manualmente si la función final coincide.

## Punto crítico: migración del administrador

La migración RBAC debe ejecutarse antes de retirar el campo legacy `profiles.role`.

Orden interno esperado:

1. Crear tablas RBAC.
2. Seed de roles/permisos.
3. Insertar en `user_roles` los usuarios existentes según `profiles.role`.
4. Verificar que el administrador real tenga rol `admin`.
5. Reemplazar helpers de autorización por RBAC.
6. Recién al final eliminar `profiles.role` y `app_role`.

Verificación posterior:

```sql
select
  p.id,
  u.email,
  p.full_name,
  p.active,
  array_agg(r.code order by r.code) as roles
from public.profiles p
join auth.users u on u.id = p.id
left join public.user_roles ur on ur.user_id = p.id
left join public.roles r on r.id = ur.role_id
group by p.id, u.email, p.full_name, p.active;
```

El usuario `gusdmeza@gmail.com` debe conservar `admin`.

## Edge Functions a desplegar en PROD

Desplegar desde la misma versión validada en DEV:

- `invite-access-user`
- `access-invitation-status`
- `activate-invited-user`
- `manage-access-user`
- `manage-delivery-driver` (deprecated, responde 410 y evita uso accidental del flujo viejo)

Todas con autenticación habilitada según la versión actualmente validada en DEV.

## Realtime

DEV validado publica actualmente:

- `business_config`
- `categories`
- `delivery_assignment_compensation`
- `delivery_assignments`
- `ingredients`
- `orders`
- `payment_methods`
- `product_ingredients`
- `products`

PROD previo al release ya publica todo lo anterior excepto las dos tablas nuevas de Delivery, que todavía no existen.

Comprobar que después de migrar PROD publique, como mínimo:

- `orders`
- `delivery_assignments`
- `delivery_assignment_compensation`

Consulta de control:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;
```

## Configuración manual de Auth / Email

Estas opciones pertenecen al proyecto Supabase PROD y no viajan con el esquema SQL:

1. Authentication → SMTP Settings
   - Configurar SMTP del remitente elegido.
   - Sender name: `La Central Burger`.
2. Authentication → Emails → Invite user
   - Aplicar `supabase/templates/invite.html`.
   - Subject sugerido: `¡Bienvenido a La Central Burger! Activá tu cuenta`.
3. Authentication → Emails → Recovery
   - Aplicar `supabase/templates/recovery.html`.
4. Authentication → URL Configuration
   - `Site URL`: URL final de producción.
   - Agregar `/activar-cuenta` a Redirect URLs.
5. Revisar expiración de enlaces, rate limits y política de contraseña.
6. Evaluar activar Leaked Password Protection si el plan/configuración del proyecto lo permite.

## Variables de entorno de producción

Antes del merge a `main`, verificar que Production apunte a `central-burguer` y no a DEV:

- `NEXT_PUBLIC_SUPABASE_URL`
- clave publishable/anon correspondiente a PROD
- cualquier URL pública del sitio usada por invitaciones/redirecciones

Nunca usar service role / secret key en variables `NEXT_PUBLIC_*`.

## Verificación de integridad posterior a la migración

Los datos comerciales históricos no deben cambiar.

```sql
select jsonb_build_object(
  'orders', (select count(*) from public.orders),
  'customers', (select count(*) from public.customers),
  'products', (select count(*) from public.products),
  'categories', (select count(*) from public.categories),
  'ingredients', (select count(*) from public.ingredients),
  'order_items', (select count(*) from public.order_items),
  'product_ingredients', (select count(*) from public.product_ingredients)
) as snapshot;
```

Esperado inmediatamente después de migrar, si no entraron operaciones nuevas durante la ventana:

- orders: 90
- customers: 76
- products: 66
- categories: 10
- ingredients: 28
- order_items: 120
- product_ingredients: 144

Las nuevas tablas Delivery deberían comenzar vacías en PROD, salvo `roles`, `permissions`, `role_permissions` y el `user_roles` del administrador real.

## Security Advisor preflight

Antes del hardening, DEV reportaba funciones trigger y administrativas con grants demasiado amplios. Se agregó `20260914050000_harden_function_execution_grants.sql` y se aplicó correctamente en DEV.

Después del hardening, las únicas funciones `SECURITY DEFINER` ejecutables por `anon` que permanecen son intencionales para el flujo público:

- `calculate_delivery_quote`
- `create_public_order`
- `is_business_open`

Las RPC de administración y Delivery continúan ejecutables por `authenticated`, pero cada una valida internamente RBAC/admin o identidad del repartidor. El linter las seguirá reportando por diseño.

Avisos no bloqueantes que permanecen:

- `citext` y `unaccent` instaladas históricamente en `public`.
- Leaked Password Protection deshabilitado (configuración Auth manual).
- Índices aún no utilizados en DEV por bajo volumen.
- Policies permisivas duplicadas en algunas tablas históricas del catálogo.

No se moverán extensiones ni se reescribirán policies históricas durante este release para evitar introducir riesgo no relacionado con Delivery.

## Smoke test obligatorio

Después del despliegue frontend:

1. Admin inicia sesión.
2. Dashboard y Reportes cargan.
3. Usuarios y roles muestra al administrador real.
4. Crear/invitar un usuario Delivery real o controlado.
5. Activar cuenta desde email.
6. Login en `/delivery/login`.
7. Crear un pedido delivery desde el sitio.
8. Confirmar aparición en pendientes de hoy.
9. Asignarlo al repartidor con porcentaje base.
10. Verificar Realtime en el portal Delivery.
11. Repetir con override de comisión por pedido.
12. Avanzar: aceptar → retirar → en camino → entregado.
13. Verificar comisión del repartidor.
14. Crear y pagar liquidación.
15. Verificar Reportes: comisión liquidada y ganancia neta.
16. Probar flujo alternativo `Cliente rechazó el pedido`.

## Advisors

Después del DDL, correr Security y Performance Advisors nuevamente y comparar contra este baseline. No se debe introducir una alerta nueva de alta severidad.

Referencias útiles:

- Security Definer executable: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Extension in public: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- Leaked Password Protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Merge Git

`central-burguer-dev` debe estar actualizado y sin commits faltantes de `main`. Recién después de que la base PROD, Functions, Realtime y configuración crítica estén listas se debe mergear a `main`.

No mergear el frontend antes de que PROD tenga el esquema RBAC/Delivery necesario.

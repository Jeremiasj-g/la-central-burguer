# Salida a producción: cuentas de clientes con Google

## Alcance y protección de datos
El alcance de esta release es **exclusivamente** la autenticación Google y la cuenta de clientes:
- Modal opcional de Google y entrada desde el header.
- Perfil editable, foto de Google, tema claro/oscuro, drawer, historial de pedidos y pantallas futuras.
- Clientes en administración, sin mezclar `auth.users` con `customers` comerciales.
- Asociación de pedidos nuevos a una sesión verificada y reclamación de un pedido de invitado mediante token temporal.
- El formulario de entrega sigue mandando **sus propios datos, ubicación GPS y cotización**. La dirección del perfil es informativa.

**No** deben desplegarse las funcionalidades de nómina o Reportes de la rama de pruebas. No copiar `auth.users`, `customers` ni `orders` desde DEV; no renumerar datos reales.

## Base de datos de producción — aplicado el 20/11/2026
Proyecto: `nryrcodrtmsrsqstozjj`, La Central Burger.

Migraciones aplicadas selectivamente, en orden:
1. `20261120235813_prod_customer_accounts_and_order_ownership.sql`
2. `20261120235817_prod_customer_profile_self_service.sql`
3. `20261120235820_prod_customer_order_claims_private.sql`
4. `20261120235823_prod_admin_customer_directory_create_delete.sql`
5. `20261120235826_prod_customer_orders_owner_alias_fix.sql`
6. `20261120235829_prod_customer_phone_validations.sql`

Conteos antes/después del cambio: **279 pedidos, 173 clientes comerciales y 7 usuarios Auth**. Las tres tablas nuevas iniciaron vacías. Sus RLS están habilitadas y las ocho RPC del nuevo módulo no pueden ejecutarse por `anon`.

Las migraciones no importan usuarios, pedidos, hashes de sesiones ni secretos. El auth de DEV y PROD son sistemas separados.

## Configuración externa obligatoria antes de publicar el login a clientes

### 1. Google Cloud
Recomendado: en el proyecto Google Cloud de La Central Burger, crear **otro OAuth Client ID de tipo Web application** específico para PRODUCCIÓN, sin compartir el Client Secret del cliente DEV.

- Nombre sugerido: `La Central Burger Web PROD`.
- **Authorized JavaScript origins:** `https://lacentralburguer.vercel.app`.
- **Authorized redirect URIs:** `https://nryrcodrtmsrsqstozjj.supabase.co/auth/v1/callback`.
- Si se agrega un dominio personalizado posteriormente, actualizar las URLs y los dominios del consentimiento.
- Consent screen: audiencia **Externa** y estado **In production** cuando se permita a cualquier comprador. En Testing solo entran los correos agregados como usuarios de prueba; validar primero con cuentas de prueba.
- Solicitar solo `openid`, `email`, `profile`, sin permisos sensibles ni acceso a Gmail.

### 2. Supabase PRODUCCIÓN
Proyecto `nryrcodrtmsrsqstozjj`:
- Authentication → Sign In / Providers → Google: habilitar y pegar el Client ID y Client Secret de **PROD**.
- Authentication → URL Configuration → **Site URL**: `https://lacentralburguer.vercel.app`.
- Redirect URLs: `https://lacentralburguer.vercel.app/mi-cuenta`.
- No desactivar el proveedor de correo globalmente: el sistema de empleados y administradores podría usarlo.
- Nunca pegar Client Secret ni contraseñas en GitHub, Vercel `NEXT_PUBLIC_*`, README o chats.

### 3. Vercel
Proyecto `la-central-burguer-gus`: ya existen variables para `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` en Production. Verificar en la consola que apunten al proyecto Supabase PROD; no sustituirlas por DEV. Google Client ID y Secret se administran en **Supabase**, no como variables públicas de Next.js.

Dominio de producción detectado: `https://lacentralburguer.vercel.app`. Si se usa otro dominio principal, debe registrarse explícitamente tanto en Google como en Supabase.

## Pruebas de aceptación
- [ ] Google OAuth en PROD con cuenta autorizada y retorno a `/mi-cuenta`.
- [ ] Registro de nuevo comprador y carga de nombre, correo y avatar de Google.
- [ ] Editar nombre, teléfono y dirección, recargar y comprobar persistencia.
- [ ] Modo claro/oscuro, drawer móvil, keyboard Escape, skeletons y animaciones.
- [ ] Comprar sin registrarse: checkout y WhatsApp siguen funcionando.
- [ ] Comprar con sesión: pedido visible únicamente en **Mis pedidos** del comprador.
- [ ] Comprar como invitado y registrar después: token de un solo uso asocia ese pedido; token reutilizado/falso no sirve.
- [ ] Asegurar que **dirección del perfil no modifica entrega ni GPS de un pedido**.
- [ ] Desde `/admin/clientes`, consultar cuentas y clientes comerciales; editar, crear y verificar protección de borrado.
- [ ] Usuario no-admin no puede llamar RPC de administración ni ver pedidos ajenos.
- [ ] Probar usuario en móvil y desktop, recuperación de red, sesión caducada y salida.
- [ ] Repasar pedidos reales, balances, informes y delivery después del deploy.

Los tests automatizados del código usan un cliente simulado; no reemplazan OAuth con Google real ni la prueba de pedidos por WhatsApp.

## Publicación y reversión
- Preparar la rama `release/customer-accounts-production-20261120` desde `main`, sin merge de nómina.
- Exigir TypeScript, tests, lint del módulo y build Vercel antes de merge.
- Cambiar el proveedor Google en PROD y URL Configuration antes de prueba real.
- Si hay incidencia de frontend, **revertir el commit o el deployment en Vercel**, no borrar tablas con historial. Deshabilitar temporalmente Google en Supabase si hay problema de acceso; compras como invitado deben continuar.
- No borrar cuentas o asociaciones de pedidos para revertir UI. Los cambios SQL son aditivos y se mantienen hasta una migración posterior explícita y auditada.

# Cuentas de clientes — desarrollo

## Alcance implementado

- Login y registro opcionales desde el header público, con Supabase Auth (Google OAuth y correo/contraseña).
- Invitación después de **crear correctamente** el pedido. «Ahora no» nunca impide comprar.
- Pantalla `/mi-cuenta`: perfil editable (nombre, teléfono, dirección informativa), correo con cambio verificado, contraseña e historial de pedidos propios.
- Administrador `/admin/clientes`: cuentas registradas y clientes comerciales en pestañas separadas, búsqueda, paginación, edición y creación de contactos comerciales. Eliminación de contactos **sin pedidos**; nunca borrado de historial.
- Pedido: `/api/orders` sigue usando **únicamente el formulario del checkout** para nombre, WhatsApp, ubicación GPS, tarifa de envío y entrega. La dirección del perfil NO es fuente de despacho.
- Un pedido nuevo realizado con una sesión Auth válida se vincula al usuario. Un invitado recibe un comprobante aleatorio de un solo uso, almacenado temporalmente en `sessionStorage`, que permite asociar **ese único pedido** al registrarse en ese navegador, durante 7 días. No se hacen vinculaciones por coincidencia de teléfono, nombre o email.
- Las cuentas Auth y los clientes comerciales (`customers`, agrupados por teléfono) **no son la misma entidad**, y no se crean roles `admin`, `staff` ni `delivery` para compradores.
- Los beneficios/promociones especiales quedan pendientes de definición con el comercio.

## Configuración manual necesaria para Google (SUPABASE DEV)

La implementación no puede generar credenciales OAuth de Google por sí sola. **Hasta completar esto, el botón Google mostrará un error de proveedor no configurado.**

1. En Google Cloud Console, crear/configurar el consentimiento OAuth y un cliente OAuth de aplicación web.
2. En **Authorized redirect URIs**, registrar la URL de callback de Supabase DEV:
   `https://vsfcjmyiiviyydvbdlrn.supabase.co/auth/v1/callback`.
3. En el panel del proyecto Supabase **DEV** → Authentication → Providers → Google: habilitarlo e introducir el Client ID y Client Secret de Google. El secreto se configura allí, **nunca en Git ni en `NEXT_PUBLIC_*`**.
4. En Authentication → URL Configuration: registrar `http://localhost:3000/mi-cuenta` y las direcciones de preview autorizadas para volver tras Google o confirmar correo. Probar el flujo desde origen exacto permitido.
5. Para registro por correo, revisar Email Auth/confirmación y configurar SMTP propio antes de usarse en producción. Los nuevos registros sin sesión requieren verificación del correo.

Referencia: https://supabase.com/docs/guides/auth/social-sign-in/auth-google y https://supabase.com/docs/guides/auth/passwords

**Producción NO fue modificada**. Al aprobar el QA y el lanzamiento, migrar el esquema y configurar OAuth/SMTP en PROD como tarea separada. No utilizar credenciales DEV en producción.

## Migraciones DEV

- `20261120120000_customer_accounts.sql`: perfiles autenticados, vinculación privada de nuevos pedidos, RLS, directorio administrador y funciones limitadas por usuario/rol.
- `20261120121000_customer_profile_rpc.sql`: editar perfil propio.
- `20261120122000_customer_order_claims.sql`: tokens aleatorios hasheados, expiración, reclamación única.
- `20261120124000_admin_customer_crud.sql`: alta/edición/eliminación controladas de contactos sin historial.
- `20261120125000_customer_orders_owner_alias_fix.sql`: corrige ambigüedad SQL detectada por pruebas de integración.

Las cinco migraciones están aplicadas solamente en `central-burguer-dev`.

## QA automático y escenarios

`npm test` ejecuta los tests existentes de Pago a empleados más `tests/clientes/customer-account.test.cjs`.

```bash
npm ci
npm test
npm run typecheck
npm run lint:clientes
npm run build
```

Prueba SQL (solo DEV, **ROLLBACK**): `supabase/tests/20261120_customer_accounts.sql`.
Se ha ejecutado de forma reversible; comprueba cuenta propia, perfil, reclamo válido, token inválido, replay, historial, restricciones de no-admin y CRUD de contacto comercial. No se crean datos de prueba permanentes.

### Aceptación manual antes de habilitar en producción

- [ ] Registro con Google con proveedor real de Google DEV.
- [ ] Registro por correo con confirmación y posterior login.
- [ ] Inicio de sesión, cierre de sesión, correo inválido, contraseña equivocada, recuperación.
- [ ] Comprar sin cuenta desde Home hasta WhatsApp (DEV no abre WhatsApp).
- [ ] Comprar con sesión y comprobar historial solo del propio usuario.
- [ ] Comprar como invitado, luego registrarse y reclamar únicamente ese pedido.
- [ ] Reabrir el link de reclamación / usar un código falso: no debe permitir vinculación indebida.
- [ ] Dos usuarios diferentes en el mismo dispositivo: sin fuga de datos entre perfiles.
- [ ] Probar edición y validación de teléfono/nombre/dirección, y que la dirección **no se envía al checkout ni al delivery**.
- [ ] Comprobar búsqueda, edición, paginación, altas y borrado protegido en `/admin/clientes`.
- [ ] Probar teléfono compartido entre dos clientes y asegurar que no aparezcan pedidos de otra persona.
- [ ] Responsive, teclado, foco visible y modal de registro en móviles.

## Consideraciones de seguridad

- Supabase Auth administra el correo y las contraseñas; las tablas de perfiles no tienen claves.
- `customer_order_links` no tiene escritura desde `authenticated` ni `anon`. Solo el servidor después de verificar JWT o la función de reclamación tras autenticar puede vincular un pedido.
- `customer_order_claims` no expone SELECT/INSERT/UPDATE a los clientes. Se almacenan hashes SHA-256; un token de 32 bytes solo se entrega al navegador que creó el pedido.
- El historial se sirve por `my_customer_orders()` con `auth.uid()`, no por coincidencia con `customer_id` comercial.
- Las funciones administrativas comprueban `private.is_admin()` en la base de datos.
- No habilitar recompensas hasta decidir reglas de negocio, consentimiento y prevención de abuso.

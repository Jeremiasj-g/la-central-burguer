# Cuentas de clientes — desarrollo

## Alcance implementado

- Inicio de sesión/registro opcional desde el header público, únicamente mediante Google OAuth de Supabase Auth. La modal destaca «¡Registrate para obtener más beneficios!» y permite continuar sin cuenta.
- Invitación después de **crear correctamente** el pedido. «Ahora no» nunca impide comprar.
- Pantalla `/mi-cuenta`: perfil editable (nombre, teléfono, dirección informativa), correo vinculado a Google de solo lectura e historial de pedidos propios. No hay contraseñas propias de La Central Burger ni edición de correo desde el perfil.
- Administrador `/admin/clientes`: cuentas registradas y clientes comerciales en pestañas separadas, búsqueda, paginación, edición y creación de contactos comerciales. Eliminación de contactos **sin pedidos**; nunca borrado de historial.
- Pedido: `/api/orders` sigue usando **únicamente el formulario del checkout** para nombre, WhatsApp, ubicación GPS, tarifa de envío y entrega. Si el usuario inicia sesión se pueden precargar **nombre y teléfono** desde su perfil cuando los campos están vacíos, pero siempre son editables antes de confirmar; la dirección, GPS y cotización de envío **nunca se precargan desde el perfil**. La dirección del perfil NO es fuente de despacho.
- Un pedido nuevo realizado con una sesión Auth válida se vincula al usuario. Un invitado recibe un comprobante aleatorio de un solo uso, almacenado temporalmente en `sessionStorage`, que permite asociar **ese único pedido** al registrarse en ese navegador, durante 7 días. No se hacen vinculaciones por coincidencia de teléfono, nombre o email.
- Las cuentas Auth y los clientes comerciales (`customers`, agrupados por teléfono) **no son la misma entidad**, y no se crean roles `admin`, `staff` ni `delivery` para compradores.
- Los beneficios/promociones especiales quedan pendientes de definición con el comercio.

## Configuración manual necesaria para Google (SUPABASE DEV)

La implementación no puede generar credenciales OAuth de Google por sí sola. **Hasta completar esto, el botón Google mostrará un error de proveedor no configurado y el visitante podrá continuar sin cuenta.**

1. En Google Cloud Console, crear/configurar el consentimiento OAuth y un cliente OAuth de aplicación web.
2. En **Authorized redirect URIs**, registrar la URL de callback de Supabase DEV:
   `https://vsfcjmyiiviyydvbdlrn.supabase.co/auth/v1/callback`.
3. En el panel del proyecto Supabase **DEV** → Authentication → Providers → Google: habilitarlo e introducir el Client ID y Client Secret de Google. El secreto se configura allí, **nunca en Git ni en `NEXT_PUBLIC_*`**.
4. En Authentication → URL Configuration: registrar `http://localhost:3000/mi-cuenta` y las direcciones de preview autorizadas para volver tras Google. Probar el flujo desde origen exacto permitido.
5. El registro público de clientes utiliza solo Google; no necesita SMTP para invitaciones o confirmaciones propias del flujo de clientes. **No deshabilitar Email Auth globalmente sin analizar los usuarios internos**, porque el personal puede depender de ese proveedor.

Referencia: https://supabase.com/docs/guides/auth/social-sign-in/auth-google

**Producción NO fue modificada**. Al aprobar el QA y el lanzamiento, migrar el esquema y configurar Google OAuth en PROD como tarea separada. No utilizar credenciales DEV en producción.

## Migraciones DEV

- `20261120120000_customer_accounts.sql`: perfiles autenticados, vinculación privada de nuevos pedidos, RLS, directorio administrador y funciones limitadas por usuario/rol.
- `20261120121000_customer_profile_rpc.sql`: editar perfil propio.
- `20261120122000_customer_order_claims.sql`: tokens aleatorios hasheados, expiración, reclamación única.
- `20261120124000_admin_customer_crud.sql`: alta/edición/eliminación controladas de contactos sin historial.
- `20261120125000_customer_orders_owner_alias_fix.sql`: corrige ambigüedad SQL detectada por pruebas de integración.
- `20261120130000_customer_phone_validations.sql`: validación de teléfono opcional de perfil y de clientes desde RPC.

Las seis migraciones están aplicadas solamente en `central-burguer-dev`.

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
- [ ] Comprobar que la modal muestra «¡Registrate para obtener más beneficios!» y únicamente «Continuar con Google» y el acceso de invitado.
- [ ] Inicio y cierre de sesión con Google, cancelación del consentimiento y errores de OAuth.
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

- Supabase Auth administra la identidad de Google; las tablas de perfiles no guardan contraseñas.
- `customer_order_links` no tiene escritura desde `authenticated` ni `anon`. Solo el servidor después de verificar JWT o la función de reclamación tras autenticar puede vincular un pedido.
- `customer_order_claims` no expone SELECT/INSERT/UPDATE a los clientes. Se almacenan hashes SHA-256; un token de 32 bytes solo se entrega al navegador que creó el pedido.
- El historial se sirve por `my_customer_orders()` con `auth.uid()`, no por coincidencia con `customer_id` comercial.
- Las funciones administrativas comprueban `private.is_admin()` en la base de datos.
- No habilitar recompensas hasta decidir reglas de negocio, consentimiento y prevención de abuso.

## Resultado de QA automatizado

- ✔ **101/101 tests de Node**, 0 fallos, al incorporar los 12 casos de clientes a los 89 existentes.
- ✔ TypeScript aprobado.
- ✔ ESLint acotado al módulo de clientes aprobado, conservando sin modificaciones dos errores previos del checkout antiguo que pertenecen al lint global.
- ✔ Build de Vercel aprobado en la rama (commit `fbc84980b85baacd13679edd10144faa7f13279c`). Cada commit posterior debe volver a pasar sus verificaciones antes de aprobar su merge.
- ✔ SQL de `supabase/tests/20261120_customer_accounts.sql` ejecutado de nuevo después de aplicar las validaciones; concluye con `ROLLBACK`. Cuenta, historial y claims sin registros de QA persistentes.

[Ver ejecución CI](https://github.com/Jeremiasj-g/la-central-burguer/actions/runs/44766791993)

El botón de Google todavía necesita pruebas con el proveedor real, sus credenciales OAuth y las URLs de redirección en DEV. La modalidad pública de correo y contraseña fue retirada por decisión del negocio; no se modificó la configuración global de correo del personal.

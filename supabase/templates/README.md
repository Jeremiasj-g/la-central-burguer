# Email templates · La Central Burger

Estos archivos versionan la identidad visual de los correos de Supabase Auth.

## Invitación de usuarios

- Template: `invite.html`
- Subject recomendado: `¡Bienvenido a La Central Burger! Activá tu cuenta`
- Evento: alta de usuarios internos mediante `inviteUserByEmail`.
- El CTA utiliza `{{ .ConfirmationURL }}` y el saludo utiliza `{{ .Data.full_name }}`.

## Recuperación

- Template: `recovery.html`
- Subject recomendado: `Recuperá tu acceso a La Central Burger`

## Proyecto hosted de Supabase

Supabase no despliega los templates hosted desde el repositorio automáticamente. Para aplicarlos al proyecto alojado, copiar el HTML correspondiente en:

`Authentication → Email Templates`

Para Invite User seleccionar **Invite user** y para recuperación seleccionar **Reset password / Recovery**.

Mientras el negocio no tenga dominio y SMTP propio, los correos pueden salir mediante el servicio de correo de Supabase sujeto a sus límites. Cuando exista dominio corporativo, configurar SMTP propio sin cambiar el flujo de la aplicación.

## URLs

La invitación solicita redirección a `/activar-cuenta`. En Supabase hosted conviene agregar las URLs de cada entorno en `Authentication → URL Configuration → Redirect URLs`, por ejemplo:

- `http://localhost:3000/activar-cuenta`
- `https://<dominio-dev>/activar-cuenta`
- `https://<dominio-produccion>/activar-cuenta`

La aplicación también incluye un guard de onboarding que redirige a `/activar-cuenta` si Supabase utiliza el Site URL como fallback.

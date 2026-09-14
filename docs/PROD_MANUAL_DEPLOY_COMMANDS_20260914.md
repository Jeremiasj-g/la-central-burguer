# Comandos controlados · Deploy Supabase PROD

> Ejecutar únicamente desde la rama `central-burguer-dev` actualizada.
>
> Proyecto PROD esperado: `nryrcodrtmsrsqstozjj` (`central-burguer`).
>
> **Nunca ejecutar `supabase db reset --linked` contra producción.**
> **Nunca usar `--include-seed` en producción.**

Este procedimiento existe porque el entorno automatizado de esta sesión puede auditar PROD pero no tiene permitido ejecutar DDL ni desplegar Edge Functions en el proyecto de producción.

## 1. Preparar el repositorio

```bash
git checkout central-burguer-dev
git pull origin central-burguer-dev
```

Comprobar que HEAD contiene al menos el release documentado y la migración de hardening.

## 2. Iniciar sesión y vincular EXPLÍCITAMENTE PROD

Si usás Supabase como dependencia/npm:

```bash
npx supabase login
npx supabase link --project-ref nryrcodrtmsrsqstozjj
```

Si tenés el CLI instalado globalmente, reemplazá `npx supabase` por `supabase`.

El CLI puede pedir la contraseña de la base. Ingresarla directamente en la terminal; no compartirla por chat ni guardarla en Git.

## 3. Backup local previo al cambio

Como la organización está actualmente en plan Free, guardar una copia local antes de tocar el esquema.

Crear una carpeta fuera de `supabase/` o asegurarse de que esté ignorada por Git:

```bash
mkdir backups-prod
```

Guardar esquema y datos públicos actuales:

```bash
npx supabase db dump --linked > backups-prod/pre-delivery-schema-20260914.sql
npx supabase db dump --data-only --linked > backups-prod/pre-delivery-data-20260914.sql
```

Comprobar que ambos archivos existen y tienen contenido antes de seguir. No subir estos backups a GitHub: el dump de datos contiene información real del negocio/clientes.

Este backup complementa el snapshot de conteos tomado por la auditoría previa; no reemplaza los backups administrados/PITR de planes superiores.

## 4. Alinear solamente el historial de migraciones ya existentes

PROD ya tiene físicamente el esquema inicial, los campos de logo y la versión final de `get_dashboard_stats`, pero su historial remoto no usa exactamente los mismos timestamps del repositorio.

Antes de `db push`, revisar:

```bash
npx supabase migration list
```

Luego alinear el historial sin volver a ejecutar SQL que ya existe:

```bash
npx supabase migration repair --status applied 202607310001
npx supabase migration repair --status applied 202607310002
npx supabase migration repair --status reverted 20260912141027
npx supabase migration repair --status applied 20260912141000
```

Qué significa:

- `202607310001`: el esquema inicial ya existe en PROD; sólo se marca como aplicado.
- `202607310002`: los campos/configuración de logo ya existen; sólo se marca como aplicado.
- `20260912141027`: es el timestamp remoto con el que se aplicó Dashboard Revenue Breakdown.
- `20260912141000`: es el timestamp equivalente versionado en Git; la definición final de `get_dashboard_stats` fue comparada y coincide, por eso se reemplaza únicamente el registro de historial.

Volver a comprobar:

```bash
npx supabase migration list
```

No continuar si aparecen migraciones remotas desconocidas o divergencias distintas de las documentadas.

## 5. Dry-run obligatorio

```bash
npx supabase db push --dry-run
```

El dry-run debe proponer únicamente estas migraciones nuevas, en este orden:

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

Si intenta aplicar `202607310001`, `202607310002`, `20260910202734` o `20260912141000`, detenerse y revisar el historial antes de continuar.

## 6. Aplicar migraciones

Sólo si el dry-run coincide exactamente:

```bash
npx supabase db push
```

No agregar `--include-seed`.

El push aplica estructura y datos de sistema versionados; no copia la base DEV ni su seed/datos operativos.

## 7. Desplegar Edge Functions

Con PROD todavía vinculado:

```bash
npx supabase functions deploy invite-access-user
npx supabase functions deploy access-invitation-status
npx supabase functions deploy activate-invited-user
npx supabase functions deploy manage-access-user
npx supabase functions deploy manage-delivery-driver
```

Estas funciones sólo dependen de variables estándar del proyecto (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) y no requieren copiar secretos personalizados de DEV.

## 8. No mergear `main` todavía

Al terminar los comandos anteriores, volver al chat y avisar que finalizaron. Desde la sesión se hará una auditoría de sólo lectura sobre PROD para comprobar:

- conteos históricos intactos;
- administrador real con rol `admin` en RBAC;
- roles/permisos correctos;
- tablas/RPC/RLS/índices esperados;
- Realtime;
- Edge Functions activas;
- Advisors de seguridad/rendimiento.

Sólo después de esas verificaciones se habilitará el PR de release para merge a `main`.

## 9. Configuraciones manuales posteriores

Una vez validado el backend PROD, completar en Supabase PROD:

- SMTP personalizado;
- template Invite user;
- template Recovery;
- Site URL;
- Redirect URL de `/activar-cuenta`;
- políticas/rate limits de Auth según corresponda.

Y en el hosting/frontend:

- verificar que variables Production apunten a `central-burguer`, no a DEV;
- resolver cualquier fallo de build Preview antes del merge.

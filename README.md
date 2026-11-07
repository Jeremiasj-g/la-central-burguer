# Backup de Edge Functions — La Central Burger

Copia del código **desplegado en Supabase producción** al 7 de noviembre de 2026.

Proyecto: `nryrcodrtmsrsqstozjj`.

Las 7 funciones se encuentran en `supabase/functions/<slug>/index.ts`.

| Función | Versión | JWT |
|---|---:|---|
| `manage-delivery-driver` | 1 | Sí |
| `access-invitation-status` | 1 | Sí |
| `activate-invited-user` | 1 | Sí |
| `invite-access-user` | 1 | Sí |
| `manage-access-user` | 3 | Sí |
| `delivery-push` | 2 | Sí |
| `admin-push` | 1 | No |

**Atención:** `manage-delivery-driver` devuelve 410 porque fue reemplazada por `manage-access-user`.

Este backup contiene código fuente; no incluye secretos del proyecto, credenciales ni variables de entorno configuradas en Supabase.

Para implementar una función en un proyecto enlazado: `supabase functions deploy <slug>`.

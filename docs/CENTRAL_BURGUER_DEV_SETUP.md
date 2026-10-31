# La Central Burger — entorno de pruebas

## Entornos (no intercambiarlos)

| | Producción | Pruebas |
| --- | --- | --- |
| Web | https://lacentralburguer.vercel.app | https://la-central-burguer-dev.vercel.app |
| Proyecto Vercel | `la-central-burguer-gus` | `la-central-burguer-dev` |
| Proyecto Supabase | `nryrcodrtmsrsqstozjj` | `grtbdtavwllwarrbccht` |
| Variable de identificación | (no definida) | `NEXT_PUBLIC_APP_ENV=development` |

La web DEV usa sus propias variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **No cambiar las variables de producción para probar.** No copiar al servidor DEV claves privadas de producción.

## Estructura y datos ya preparados

- Esquema aplicado a partir de las 32 migraciones versionadas del repositorio.
- 33 tablas, 88 funciones PostgreSQL, 45 políticas RLS, tres buckets.
- 10 categorías, 66 productos, 37 ingredientes y 188 relaciones de recetas, con precios de catálogo.
- Métodos de pago y configuración de negocio con datos de contacto *ficticios* en DEV.
- Galería habilitada, con una imagen de ejemplo enlazada temporalmente al Storage público original.
- Una campaña de prueba del 25% hasta el 31/12/2026.
- Sin clientes, pedidos ni cuentas Auth reales importadas.

En DEV los pedidos **no abren WhatsApp**, y hay un aviso de «ENTORNO DE PRUEBAS». Los pedidos nuevos se guardan en DEV y sirven para probar reportes, estados y descuentos.

## Pasos privados restantes

Estos pasos requieren tu propia clave secreta **del proyecto DEV**. No publicar, pegar en chats, commitear ni usar claves de producción.

### 1. Copiar los archivos públicos de Storage al proyecto DEV

Obtén la clave desde Supabase **central-burguer-dev → Project Settings → API Keys → Secret key** (o la antigua `service_role`, si es la disponible).

En PowerShell, desde la raíz del repositorio:

```powershell
$env:DEV_SUPABASE_SECRET_KEY = "<clave privada del proyecto DEV>"
node scripts/setup-dev.mjs
Remove-Item Env:DEV_SUPABASE_SECRET_KEY
```

El script lee exclusivamente las referencias a los archivos públicos que ya constan en DEV, descarga los originales visibles públicamente, los sube a sus buckets en **DEV** y luego sustituye las URLs en DEV. Las imágenes de otros servidores no se alteran.

### 2. Crear una cuenta administradora solo para DEV

Usá un email que controles y una contraseña robusta. En PowerShell:

```powershell
$env:DEV_SUPABASE_SECRET_KEY = "<clave privada del proyecto DEV>"
$env:DEV_ADMIN_EMAIL = "<tu correo de pruebas>"
$env:DEV_ADMIN_PASSWORD = "<contraseña aleatoria robusta de al menos 14 caracteres>"
node scripts/setup-dev.mjs --admin
Remove-Item Env:DEV_SUPABASE_SECRET_KEY,Env:DEV_ADMIN_EMAIL,Env:DEV_ADMIN_PASSWORD
```

Este flujo utiliza la API administrativa oficial de Supabase Auth y asigna el rol `admin` en RBAC (no escribe directamente sobre `auth.users`). Por seguridad, nunca se almacenan contraseñas en el repositorio.

Si ya creaste el usuario desde Auth → Users, asigná su perfil activo y rol admin desde el panel SQL **de DEV**, usando el ID concreto del usuario. No ejecutar esto sobre producción.

### 3. Configurar funcionalidades con secretos de servidor

En **Vercel → la-central-burguer-dev → Settings → Environment Variables**, si las rutas de servidor las necesitan:

- `SUPABASE_SECRET_KEY`: **solo** clave secreta del Supabase DEV; requerida por flujos administrativos/de servidor.
- `SERPAPI_API_KEY` y `DELIVERY_QUOTE_SECRET`: solo para cotización real de rutas de delivery. Pueden generar consumo de API.
- Las notificaciones Web Push requieren su propia configuración VAPID de desarrollo; no copiar suscripciones ni claves del negocio.

Agregar las variables exclusivamente al proyecto Vercel DEV y desplegar nuevamente. **Jamás** usar el prefijo `NEXT_PUBLIC_` para claves secretas.

## Checklist para pruebas

1. Abrir la web DEV: comprobar banner de pruebas y catálogo con imágenes.
2. Entrar con la cuenta admin DEV: abrir Productos, Categorías, Ingredientes, Descuentos, Galería y Configuración.
3. Subir/cambiar una imagen: verificar que la URL comience con `https://grtbdtavwllwarrbccht.supabase.co/storage/`.
4. Crear un pedido de retiro desde el Home: debe guardarse solo en DEV, sin abrir WhatsApp.
5. Ver pedido en Admin, cambiar estados y consultar Reportes. Verificar precio cobrado y descuentos.
6. Activar/ocultar la galería: comprobar aparición automática en una pestaña pública abierta.
7. Probar delivery por GPS y rutas solo después de configurar las credenciales de rutas. No habilitar notificaciones externas con credenciales reales.

La replicación de la **estructura**, la creación pública de pedidos en transacción revertida, la lectura anónima de catálogo/galería y las restricciones de acceso sin sesión fueron comprobadas. La creación real de usuarios, las cargas físicas en Storage y las pruebas de rutas/push todavía requieren completar los pasos privados indicados.

# La Central Burger

Sistema de menú, pedidos y administración para hamburguesería, construido con Next.js, TypeScript, Tailwind CSS, Supabase, Recharts, React Loading Skeleton, React-Toastify, Swiper y Lucide React.

## Instalación local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Conectar Supabase

1. Crear un proyecto vacío en Supabase.
2. Ejecutar `supabase/full_setup.sql` en SQL Editor.
3. Crear el usuario administrador en Authentication.
4. Crear `gusdmeza@gmail.com` en Supabase Auth y ejecutar `supabase/promote_admin.sql`.
5. Copiar `.env.example` como `.env.local` y completar las dos variables públicas.
6. Reiniciar `npm run dev`.

Guía completa: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Fuente de datos

Supabase es la única fuente de verdad para:

- autenticación administrativa;
- productos, categorías, ingredientes y recetas;
- configuración del negocio y métodos de pago;
- pedidos, clientes, historial y notificaciones;
- dashboard y registro de ventas;
- imágenes nuevas de productos mediante Storage.

El proyecto ya no muestra pedidos ni métricas ficticias cuando faltan las variables de entorno. En ese caso informa el error de configuración correspondiente.

## Persistencia en el navegador

`localStorage` se utiliza solo para información temporal del cliente:

- `central_cart`: productos, cantidades y aclaraciones del carrito;
- `central_checkout_draft_v1`: nombre, teléfono, entrega, dirección, ubicación, método de pago y observaciones aún no confirmadas. El borrador vence automáticamente después de 24 horas.

Esto permite cerrar la página, recargarla o cambiar de pestaña sin perder el pedido en preparación. Al confirmar correctamente un pedido en Supabase, se limpian el carrito y el borrador del checkout.

Los datos administrativos antiguos que hayan quedado en `localStorage` se eliminan automáticamente y nunca se usan como origen del panel.

## Archivos de base de datos

- `supabase/full_setup.sql`: instalación completa recomendada.
- `supabase/migrations/202607310001_initial_schema.sql`: estructura, seguridad y funciones.
- `supabase/seed.sql`: configuración y catálogo inicial.
- `supabase/promote_admin.sql`: promoción del primer administrador.
- `supabase/verification.sql`: comprobaciones de instalación y catálogo.

## Documentación

- [Análisis integral del proyecto](docs/COMPLETE_PROJECT_ANALYSIS.md)
- [Modelo de datos](docs/DATABASE_MODEL.md)
- [Diagrama entidad–relación](docs/DATABASE_ERD.md)
- [Trazabilidad funcional](docs/PROJECT_DATABASE_AUDIT.md)
- [Configuración de Supabase](docs/SUPABASE_SETUP.md)
- [Política de persistencia](docs/PERSISTENCE_POLICY.md)

## Panel administrativo

Ruta: `/admin/login`.

Solo ingresan usuarios de Supabase Auth cuyo perfil tenga `role = admin` y `active = true`. La contraseña nunca se almacena en el frontend ni en tablas públicas.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

## Arquitectura

```txt
UI → hooks → services → Supabase

Cliente en preparación:
UI → hooks → services → localStorage (carrito y borrador de checkout)
```

Supabase no se importa directamente dentro de componentes visuales.

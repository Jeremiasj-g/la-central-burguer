# Pago a empleados — V2 de desarrollo

**Estado:** V2 funcional en la rama `feat/staff-payroll-v1-dev-20261116`. **Base habilitada:** únicamente `central-burguer-dev` (`vsfcjmyiiviyydvbdlrn`); el cliente contiene un bloqueo explícito para otras URLs. No desplegar ni migrar a producción sin autorización.

## Alcance y decisiones

La identidad proviene de los perfiles de Usuarios con rol `staff`; no se crean empleados duplicados. `staff_employees` es el legajo estable para conservar relaciones de asistencias, liquidaciones y pagos.

1. **Personal:** nombre y estado sincronizados con Usuarios; tarifas versionadas según lunes-viernes, sábado y domingo. Una tarifa nueva no recalcula jornadas aprobadas.
2. **Asistencias:** grilla de **una fila por empleado** y siete días de la semana; navegación por semanas, checks generales e individuales y control explícito de ausencia. Estados distintos: sin registrar / presente / ausente / pendiente de aprobación / aprobado / liquidado. Un check general desmarcado **no** convierte en ausente al personal: descarta la selección masiva de ese día. Los días futuros y períodos liquidados se bloquean.
3. **Guardado semanal:** se revisa cantidad de cambios, se confirma y se llama `admin_staff_save_week(jsonb)`. Guarda todos los cambios en la misma transacción, exige el identificador de registro esperado para detectar cambios concurrentes y deja las asistencias pendientes. Ningún check guarda directamente ni aprueba.
4. **Aprobaciones:** pueden aprobarse individualmente o por semana, con confirmación. `admin_staff_approve_week(uuid[])` utiliza la RPC de aprobación existente y revierte todo el lote ante cualquier error. El snapshot del importe se fija al aprobar.
5. **Liquidaciones:** el administrador elige período (máximo 93 días) y revisa por empleado jornadas aprobadas, importes y bloqueos por pendientes, falta de aprobadas o períodos solapados. Puede liquidar individualmente o seleccionar a los elegibles para `admin_staff_create_payroll_batch(uuid[],date,date)`. Todo el lote es atómico. Días sin registrar **no se suponen** como ausencias ni como presentes; requieren gestión humana.
6. **Anticipos y pagos:** se diferencian mediante un filtro dentro de Pagos. Cada anticipo puede aplicarse explícitamente a una liquidación y se descuenta de su saldo; una aplicación no representa una nueva salida de dinero. Reversiones con motivo y conservación del historial.
7. **Comprobante interno:** en una liquidación, botón `Comprobante`: carga el período histórico, muestra jornadas e importes snapshot, pagos, anticipos y saldo. `Imprimir / PDF` abre el diálogo del navegador para imprimir o guardar como PDF. **No es un recibo laboral legal ni acredita una transferencia.**

## Migraciones versionadas V2

- `supabase/migrations/20261119130000_staff_payroll_v2_weekly_and_batch.sql`
- `supabase/migrations/20261119133000_staff_payroll_v2_lock_posted_period.sql`
- `supabase/migrations/20261119135000_staff_payroll_v2_atomic_week_approvals.sql`

Estas migraciones fueron aplicadas a `central-burguer-dev`. Se conservan las tablas, columnas y contratos financieros históricos de V1. Las RPC son `SECURITY DEFINER` y verifican `private.is_admin()`. `anon` no tiene `EXECUTE`; `authenticated` solo puede operar si el usuario tiene rol de administrador.

## Pruebas de regresión

`supabase/tests/20261119_staff_payroll_v2.sql` usa `BEGIN … ROLLBACK` y verifica:
- guardado de ausencia sin pago;
- rechazo de snapshot obsoleto y fecha futura;
- aprobación de ausencia con valor cero y rechazo de aprobación duplicada;
- liquidación por lote con snapshot;
- bloqueo de modificaciones dentro de un período ya liquidado;
- denegación de permisos `EXECUTE` para `anon`.

La suite SQL pasó en desarrollo y revirtió sus operaciones. Aún quedan por ejecutar localmente `typecheck`, `lint`, `build` y revisión visual real en escritorio/móvil; no confundir pruebas SQL con aceptación completa de frontend.

## Recorrido manual de aceptación

1. Abrir `/admin/personal` con administrador y comprobar los empleados vinculados a Usuarios.
2. Crear tarifa vigente, ir a Asistencias, avanzar y retroceder semanas y comprobar límites de fechas.
3. Marcar individualmente y mediante encabezado. Desmarcar un encabezado no debe generar ausencias. Para ausencias, usar el botón específico `—`. Descartar, volver a marcar, elegir Revisar y guardar y confirmar.
4. Expandir `Ver` de un empleado y comprobar cada estado e importe. Aprobar pendientes individualmente o en lote. Registrar una corrección aprobada con motivo mediante el formulario anterior.
5. Ir a Liquidaciones. Seleccionar período, observar incidencias, seleccionar elegibles y confirmar lote. Comprobar que no se duplican liquidaciones ni jornadas.
6. Registrar anticipo, aplicar a una liquidación, registrar pago parcial, comprobar saldo y revertir con motivo.
7. Abrir Comprobante, comprobar importes históricos y probar Imprimir / PDF.
8. Probar sin rol de administrador y con datos concurrentes; las operaciones deben rechazarse sin cambios parciales.

## Límites explícitos

- Es un **registro interno de jornadas y pagos**, no nómina laboral argentina formal. No calcula aportes, retenciones, licencias, horas extra, feriados, jornada parcial ni nocturnidad; definir las reglas antes de programarlas.
- No crea transferencias bancarias ni confirma movimientos externos.
- El lote de liquidaciones es una operación atómica sobre liquidaciones individuales existentes; no hay todavía una entidad persistente adicional de “período cerrado” ni una secuencia de aprobación independiente por lote.
- No hay fichaje de entrada/salida ni portal del empleado.
- La vista previa se calcula con datos leídos previamente; PostgreSQL vuelve a validar todo al confirmar.
- Para un período sin asistencias no puede inferirse automáticamente qué días se esperaba que el empleado trabajara. Los registros faltantes se gestionan explícitamente.
- Mantener pruebas visuales y de compilación como pendientes hasta ejecutarlas realmente.

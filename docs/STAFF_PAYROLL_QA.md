# QA automatizado — Pago a empleados

## Objetivo y alcance

Suite **local, aislada y reproducible** para el módulo `/admin/personal`. No crea usuarios, asistencias, liquidaciones o pagos reales en `npm test`. Trabaja con fixtures sintéticos y ejecuta funciones/handlers del código existente (no cálculos copiados dentro de las pruebas).

**La suite actual define 89 casos de prueba** distribuidos en 6 archivos de Node; la cifra es de **tests definidos**, no de tests aprobados. Un test es aprobado sólo cuando su ejecución finaliza con éxito. El comando imprime `✔` para cada caso que pasa, `✖` para cada fallo y termina con código distinto de cero si hay errores.

## Cómo ejecutarla

Desde la raíz del repositorio, con Node.js 22 recomendado y `npm ci` ya ejecutado:

```bash
npm test
```

Alternativas:

```bash
npm run test:personal           # Lo mismo, sólo Pago a empleados
npm run test:qa                 # Tests + TypeScript + ESLint del módulo, en una sola ejecución
npm run test:personal:coverage  # Informe de cobertura del ejecutor Node
npm run typecheck               # Validación TypeScript de todo el proyecto
npm run lint:personal           # ESLint de Pago a empleados y scripts de QA
npm run lint                    # ESLint global (puede mostrar problemas preexistentes de otros módulos)
npm run build                   # Build Next.js; puede requerir variables de entorno
```

`test:personal:coverage` informa cobertura instrumentada por Node; **no significa** cobertura total de UI, de PostgreSQL ni de interacciones reales en navegador. No hay servidor, sesión ni credenciales Supabase involucradas en `npm test`.

### Pruebas sobre Supabase DEV — comando separado, opt-in

Los tests SQL se ejecutan con un cliente PostgreSQL `psql` instalado y **sólo contra** `central-burguer-dev` (`vsfcjmyiiviyydvbdlrn`). El ejecutor exige una cadena de conexión que contenga el identificador DEV en el host o usuario; rechaza producción.

En una terminal local, definir `QA_SUPABASE_DATABASE_URL` de manera privada (no subir la URL al repositorio), y ejecutar:

```bash
npm run test:personal:db
```

El runner ejecuta por orden:
1. `supabase/tests/20261116_staff_payroll_v1.sql` — tarifas sábado/domingo, correcciones y auditoría, pagos y anticipos, dobles importes, idempotencia, sobrepagos, reversiones, sincronización de rol y denegación de no-admin.
2. `supabase/tests/20261116_staff_factual_dates.sql` — fechas futuras de asistencia, pagos, liquidación y aprobación.
3. `supabase/tests/20261119_staff_payroll_v2.sql` — guardado semanal, snapshot obsoleto, fechas futuras, **rechazo de cambios duplicados idénticos sobre un mismo empleado/día**, aprobación masiva, ausencia a $0, lote de liquidaciones, protección de períodos liquidados y RPC sin permiso anónimo.

Los tres archivos usan transacciones con `BEGIN` y `ROLLBACK`. **No** usar este comando contra producción; no agregar credenciales ni contraseñas a Git. El comando corta inmediatamente ante el primer error y confirma en consola que observó `ROLLBACK`.

La ejecución SQL desde una conexión directa necesita el rol apropiado para simular los JWT de prueba y tener al menos un usuario administrador y un empleado habilitado. Si la base no tiene los fixtures requeridos, fallará con una explicación; no se crearán datos persistentes para forzar el pase.

## Hallazgo real y corrección durante QA

En `central-burguer-dev` la versión inicial de `admin_staff_save_week` admitía dos elementos JSON idénticos para un mismo empleado y día. Se reprodujo mediante una transacción reversible: devolvía `count=2` en lugar de rechazar el lote. Se corrigió validando duplicados de **(employee_id, day) antes de escribir ninguna fila**, se creó la migración `supabase/migrations/20261119160000_staff_week_reject_duplicate_items.sql`, se aplicó **únicamente a DEV** y se añadió una prueba de regresión en la suite V2. La prueba posterior **pasó**, y todas las suites SQL siguieron completándose con `ROLLBACK`.

## Inventario de casos automatizados

| Archivo | Casos | Lo que verifica |
|---|---:|---|
| `financial.test.cjs` | 25 | Saldos, jornadas históricas, pagos parciales, reversiones, anticipos disponibles, centavos, períodos, incidencias, ausencias y bloqueos de liquidación |
| `attendance-ui.test.cjs` | 19 | Semanas, lunes/domingo, cruces de mes y año, estructura real React SSR, estados, filas, fechas futuras, detalle expandible y confirmación por empleado |
| `attendance-interactions.test.cjs` | 12 | Callbacks reales de marcar presencia y ausencia, selección masiva y desmarcado, inactivos, jornadas aprobadas/liquidadas, aprobación separada del guardado |
| `services.test.cjs` | 16 | Bloqueo de Supabase PROD, propagación de errores, parámetros reales de RPC, tarifas, asistencias, aprobación, liquidación, pago, anticipo, reversión e idempotencia |
| `exports.test.cjs` | 5 | Filtrado, tipos, importes numéricos, reversiones y bytes de libro XLSX real |
| `contracts.test.cjs` | 12 | Contratos estáticos de UI: cambios sin guardar, fechas, confirmaciones, accesibilidad, animación, exportación y protección histórica |
| **Total** | **89** | **Se deben ejecutar para confirmar aprobación** |

Las pruebas SSR y de handlers son automatizadas pero **no sustituyen** interacción con un navegador real. Las pruebas de RPC de `services.test.cjs` usan un cliente simulado para comprobar parámetros y errores: las pruebas de ejecución verdadera contra PostgreSQL están en SQL.

## Semáforo de salida para la V2

Para declarar la versión lista, el equipo debe confirmar:

- [ ] `npm test` termina con **89 aprobados y 0 fallos**.
- [ ] `npm run typecheck` sin errores.
- [ ] `npm run lint` sin errores.
- [ ] `npm run build` sin errores, con variables apropiadas.
- [ ] `npm run test:personal:db` termina con tres suites SQL revertidas en DEV, o ejecución SQL equivalente verificada por el equipo.
- [ ] Prueba real en escritorio y móvil de navegación de semanas, checks y estado pendiente.
- [ ] Modal guardar por empleado: filtros, scroll, botón Cancelar, guardar, error de red y doble clic.
- [ ] Aprobar y corregir una asistencia; comprobar que lo aprobado mantiene su tarifa snapshot.
- [ ] Liquidar períodos con incidencias, seleccionar varios, confirmar y abrir comprobante.
- [ ] Anticipar, aplicar y revertir; comprobar saldos y Excel abierto en Excel/LibreOffice.
- [ ] Accesibilidad visual de dropdown, animación de expansión/contracción sin fade, foco y teclado.
- [ ] Probar roles no-admin sin acceso y comprobar que producción sigue bloqueada.

## CI

`.github/workflows/personal-qa.yml` ejecuta `npm run test:personal`, TypeScript y **ESLint acotado al módulo** al publicar cambios relevantes en la rama de pruebas o al crear un PR. No necesita credenciales Supabase. El lint global del repositorio se mantiene disponible con `npm run lint` pero no bloquea este workflow por errores preexistentes ajenos a Pago a empleados. Los SQL contra DEV se ejecutan **sólo por opt-in**, para evitar acciones financieras remotas accidentales.

## Limitaciones y reglas de interpretación

- **No afirmar que los 89 tests pasaron** sin leer una ejecución que muestre el resultado. Estar definidos en el repositorio no significa que estén ejecutados.
- QA no es equivalencia con recibos laborales argentinos, ni pruebas de transferencias reales.
- Las validaciones SQL requieren base DEV; no se ejecutan con `npm test` por seguridad.
- Las pruebas de navegador y accesibilidad de extremo a extremo siguen siendo un paso de aceptación distinto.
- Si falla un test, detener la entrega y analizar si es una regresión real, un requisito contradictorio o un test que debe corregirse. Nunca eliminar una aserción sólo para forzar un check verde.

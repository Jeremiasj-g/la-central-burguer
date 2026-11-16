# Pago a empleados · V1 de desarrollo

Implementación inicial **solo en Supabase central-burguer-dev** (ref: vsfcjmyiiviyydvbdlrn). No desplegar migraciones de este módulo en producción sin revisión posterior.

## Alcance

- **Personal:** alta, edición, desactivación y tarifas versionadas para lunes-viernes, sábado y domingo.
- **Asistencias:** presente o ausente por fecha; aprobación que fija tarifa; corrección de aprobadas con motivo; jornadas liquidadas inmutables.
- **Liquidaciones:** período manual por empleado; incorpora una sola vez las asistencias aprobadas y evita períodos superpuestos; congela importes de cada jornada.
- **Pagos:** registrar egresos parciales, anticipos independientes, aplicaciones de anticipos a liquidaciones y reversiones motivadas y auditables.

Tablas específicas en tercera forma normal: staff_employees, staff_pay_rates, staff_attendance, staff_attendance_corrections, staff_payrolls, staff_payroll_lines, staff_payments y staff_advance_allocations. Los importes históricos de las asistencias y liquidaciones se guardan como snapshots intencionales. Lectura restringida a administradores por RLS; escrituras únicamente por RPC verificando el rol en PostgreSQL. No se borran movimientos.

## Configuración local

1. Usar la rama **feat/staff-payroll-v1-dev-20261116** del repositorio Jeremiasj-g/la-central-burguer.
2. Configurar en .env.local:
   - NEXT_PUBLIC_SUPABASE_URL=https://vsfcjmyiiviyydvbdlrn.supabase.co
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<clave pública de central-burguer-dev> (Supabase → Settings → API Keys).
3. Ejecutar npm install y npm run dev. Ingresar como administrador y abrir /admin/personal.
4. Las migraciones supabase/migrations/20261116095000_staff_payroll_v1.sql y supabase/migrations/20261116113000_staff_payroll_money_validation.sql **ya están aplicadas al proyecto dev**. No aplicarlas en producción sin una revisión y autorización expresa.

## Recorrido de aceptación

1. Agregar empleado y tarifa con vigencia.
2. Registrar presente y aprobarlo; comprobar tarifa según día. Registrar ausente; comprobar importe cero.
3. Corregir una asistencia aprobada con motivo y volver a aprobarla.
4. Generar liquidación; comprobar que no se permite duplicar jornadas, solapar períodos ni liquidar pendientes.
5. Registrar un anticipo, aplicarlo a una liquidación y completar el saldo con pagos parciales.
6. Revertir aplicaciones y pagos indicando motivo; deben permanecer visibles como reversados.
7. Validar que un usuario no administrador no puede leer información ni llamar a las RPC.

## Límites de V1

- El registro de asistencias es manual y administrativo: no hay fichada de entrada/salida ni portal del empleado.
- No se han acordado reglas para feriados, turnos parciales, horas extra, nocturnidad o jornadas incompletas: no se calculan automáticamente.
- La periodicidad de liquidación no se presupone; cada período lo selecciona el administrador.
- Anticipos no se aplican automáticamente: se asignan a una liquidación de forma explícita.
- No se realizan transferencias bancarias ni se emiten recibos PDF. Se registran pagos ya realizados fuera de la aplicación.
- No se modifica el esquema ni las liquidaciones de repartidores.
- No se cargan empleados ficticios. Las pruebas de transacciones se ejecutaron con ROLLBACK.
- Los previews de Vercel pueden tener variables de otro proyecto; comprobarlas antes de probar contra la base de desarrollo.

## Verificación

Usar npm run typecheck, npm run lint y npm run build. Compilar no reemplaza probar flujos con sesión administrativa real. Los ensayos de SQL y permisos se realizaron en central-burguer-dev y dejaron los datos originales intactos.

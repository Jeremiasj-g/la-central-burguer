# Cobros unificados — plan de implementación y seguridad

**Rama:** `feat/unified-payments`. **No habilitar pagos combinados en producción hasta completar el circuito entero.**

## Fase 1 — Fundaciones (incluida en esta rama)
- Migración aditiva: preferencia del cliente, planes de cobro, movimientos confirmados con idempotencia, auditoría básica y RLS de lectura administrativa.
- Utilidades compartidas de distribución y saldos; ninguna ruta de checkout cambia de comportamiento.
- Los pedidos históricos no se convierten automáticamente en cobros confirmados.

## Fase 2 — Administración de cobros (implementada en la rama, NO activada)
- Migración adicional: RPC `admin_set_order_payment_plan`, `admin_confirm_order_payment` y `admin_reverse_order_payment` con autenticación/rol admin, bloqueo por pedido, validaciones, idempotencia y reversión auditada.
- Admin → Pedidos: botón **Cobro**, modal mobile-first que muestra saldos, permite distribuir transferencia/efectivo, confirmar dinero verificado y corregir con motivo.
- El backend no permite confirmar efectivo de delivery desde la administración: ese flujo requiere la confirmación del repartidor en Fase 3.
- No se infieren pagos a partir de pedidos legacy; los cobros existentes solo pueden registrarse después de una verificación real.
- Al guardar la distribución, la preferencia declarada también se actualiza sin marcar cobros como recibidos.
- Prueba SQL reversible disponible en `supabase/tests/20261107_admin_payment_transactions.sql`: idempotencia, límites, reversión y permisos.
- Los movimientos directos por Data API son solo lectura de administradores; no se otorga permiso INSERT/UPDATE/DELETE.
- **Pendientes de esta fase ampliada:** reintegros, proteger editor/cancelación de pedidos ya cobrados, referencias de liquidación y prueba integral autenticada en una base aislada.

**Advertencia:** el botón y las funciones están diseñados en esta rama de trabajo. La base de producción **no** tiene estas migraciones todavía. No se debe fusionar a `main` hasta completar el sistema entero y las pruebas end-to-end.

## Control de activación para fusionar sin afectar producción
- `NEXT_PUBLIC_ENABLE_MIXED_PAYMENTS=true` habilita selector público y botón Cobro administrativo, por defecto permanecen ocultos.
- `ENABLE_MIXED_PAYMENTS=true` habilita el endpoint de creación combinada del servidor; por defecto responde 409 sin crear pedidos.
- No configurar estas variables en producción hasta aplicar y probar las migraciones y completar los circuitos de reparto, cancelación, edición y liquidación.

## Fase 2b — Checkout público combinado (implementado en la rama, NO activado)
- Selector **Pago combinado** solo cuando efectivo y transferencia estén habilitados.
- El cliente indica la transferencia; el efectivo restante se calcula automáticamente, sin marcar ningún cobro como confirmado.
- El endpoint verifica la cotización del reparto y utiliza `create_public_order_with_payment_plan(jsonb)` para crear pedido y desglose en una transacción.
- Los importes se verifican contra el total final recalculado por PostgreSQL; si cambió el precio, se cancela la creación sin dejar un pedido a medias.
- WhatsApp muestra ambos importes y los datos de transferencia; se indica explícitamente que no están acreditados.
- El histórico y los pedidos normales siguen por la RPC existente, sin interpretar `orders.payment_method` como dinero recibido.
- **No funciona hasta aplicar las migraciones de la fase 1 y 2b en una base de pruebas.** No ejecutar en producción.

## Fase 3 — Integración completa (pendiente)
- Checkout público: implementado en fase 2b; pendiente de prueba integrada y habilitación.
- Pedidos: modal Cobro independiente de Editar pedido.
- Venta mostrador: cobro completo con desglose en una sola transacción.
- Delivery: transferencia verificada antes de asignar, efectivo exacto a cobrar y confirmación de repartidor.
- Liquidaciones: incluir únicamente efectivo recibido y no rendido; comisiones por separado.
- Reportes: separar facturación por fecha de venta de recaudación por fecha de cobro, conservar historial legacy.

## Verificaciones previas al despliegue
- [ ] SQL aplicado y comprobado en ambiente de pruebas, no en producción
- [ ] RLS y permisos de RPC revisados
- [ ] Dos confirmaciones simultáneas no duplican cobros
- [ ] Reintento con misma idempotency key no duplica movimientos
- [ ] Edición de pedido recalcula saldo, no borra cobros
- [ ] Delivery de 30.000 con 20.000 transferidos cobra y rinde solo 10.000
- [ ] Venta mostrador registra una venta, dos cobros
- [ ] Reportes no duplican facturación y separan cobros por fecha
- [ ] Cancelación con cobros conserva historial y requiere reintegro
- [ ] Compatibilidad con pedidos históricos comprobada
- [ ] UX mobile revisada

**Nota:** El esquema de movimientos se entrega sin permisos de escritura para clientes ni administradores; no se activará hasta que existan operaciones transaccionales seguras.

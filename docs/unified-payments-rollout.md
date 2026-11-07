# Cobros unificados — plan de implementación y seguridad

**Rama:** `feat/unified-payments`. **No habilitar pagos combinados en producción hasta completar el circuito entero.**

## Fase 1 — Fundaciones (incluida en esta rama)
- Migración aditiva: preferencia del cliente, planes de cobro, movimientos confirmados con idempotencia, auditoría básica y RLS de lectura administrativa.
- Utilidades compartidas de distribución y saldos; ninguna ruta de checkout cambia de comportamiento.
- Los pedidos históricos no se convierten automáticamente en cobros confirmados.

## Fase 2 — Operaciones transaccionales (pendiente)
- RPC autenticadas para registrar plan, confirmar efectivo/transferencia, reversar, reintegrar y confirmar efectivo del repartidor.
- Validación en backend de importes, roles, pertenencia del reparto, límites y bloqueo concurrente del pedido.
- Bloqueo de mutaciones directas; auditar actor, fecha, razón y referencia al movimiento original.
- Revisar que la operación de editar pedido preserve cobros y detecte excedentes.

## Fase 3 — Integración completa (pendiente)
- Checkout público: opción combinado y WhatsApp sin declarar cobro confirmado.
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

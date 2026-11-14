-- Rentabilidad: completar márgenes de promociones ya costeadas.
-- Confirmación del cliente (13/11/2026): las recetas compuestas y precios
-- utilizados rigen desde el 31/10/2026 (hora de Argentina).
-- No se modifica el precio de venta, las recetas, los pedidos ni el costo
-- histórico ya guardado. No incluir pedidos cancelados.
--
-- La marca backfill_client_confirmed permite distinguir un costo reconstruido
-- de la instantánea capturada al crear la venta. Idempotente: sólo completa
-- filas sin costo cuyos productos tienen una receta actualmente completa.

with calculated as (
  select
    oi.id as order_item_id,
    oi.quantity as sold_quantity,
    private.recipe_cost_unit(p.id) as unit_recipe_cost
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where p.is_promotion = true
    and p.deleted_at is null
    and o.status <> 'cancelado'
    and o.created_at >= (
      timestamp '2026-10-31 00:00:00'
      at time zone 'America/Argentina/Buenos_Aires'
    )
    and o.created_at <= now()
    and oi.cost_snapshot_status is distinct from 'complete'
    and oi.unit_cost_snapshot is null
    and oi.total_cost_snapshot is null
)
update public.order_items oi
set
  unit_cost_snapshot = round(calc.unit_recipe_cost, 4),
  total_cost_snapshot = round(
    round(calc.unit_recipe_cost, 4) * calc.sold_quantity,
    4
  ),
  cost_snapshot_status = 'complete',
  cost_snapshot_source = 'backfill_client_confirmed',
  cost_snapshot_at = now()
from calculated calc
where oi.id = calc.order_item_id
  and calc.unit_recipe_cost is not null
  and calc.unit_recipe_cost > 0
  and calc.sold_quantity > 0
  and oi.cost_snapshot_status is distinct from 'complete'
  and oi.unit_cost_snapshot is null
  and oi.total_cost_snapshot is null;

-- Reconstrucción acotada de costos para ventas desde el 31/10/2026 (Argentina).
-- Confirmación comercial del cliente (09/11/2026): las recetas y los precios
-- de ingredientes actuales aplican desde el 31/10/2026.
--
-- NO modifica pedidos, precios de venta, cantidades, ventas canceladas,
-- ni instantáneas ya capturadas. Sólo completa costos ausentes de ventas válidas.
-- Una receta ausente o incompleta queda con costo NULL: NUNCA se supone cero.
-- Los importes resultantes son MARGEN BRUTO de producto, no utilidad neta.

alter table public.order_items
  drop constraint if exists order_items_cost_snapshot_source_check;
alter table public.order_items
  add constraint order_items_cost_snapshot_source_check
  check (
    cost_snapshot_source is null or
    cost_snapshot_source in (
      'order_insert',
      'order_edit',
      'backfill_current',
      'backfill_client_confirmed'
    )
  );

with calculated as (
  select
    oi.id,
    count(pi.id) as recipe_lines,
    count(pi.id) filter (
      where pi.quantity is null or pi.quantity <= 0
        or i.id is null or i.unit_cost is null or i.unit_cost <= 0
        or not (
          pi.unit = i.unit
          or (i.unit::text = 'kg' and pi.unit::text = 'gr')
          or (i.unit::text = 'gr' and pi.unit::text = 'kg')
          or (i.unit::text = 'litro' and pi.unit::text = 'ml')
          or (i.unit::text = 'ml' and pi.unit::text = 'litro')
        )
    ) as invalid_lines,
    sum(
      pi.quantity * i.unit_cost *
      case
        when pi.unit = i.unit then 1
        when i.unit::text = 'kg' and pi.unit::text = 'gr' then 0.001
        when i.unit::text = 'gr' and pi.unit::text = 'kg' then 1000
        when i.unit::text = 'litro' and pi.unit::text = 'ml' then 0.001
        when i.unit::text = 'ml' and pi.unit::text = 'litro' then 1000
        else null
      end
    ) as calculated_unit_cost
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.product_ingredients pi on pi.product_id = oi.product_id
  left join public.ingredients i on i.id = pi.ingredient_id
  where
    o.created_at >= (timestamp '2026-10-31 00:00:00' at time zone 'America/Argentina/Buenos_Aires')
    and o.created_at <= now()
    and o.status <> 'cancelado'
    and oi.cost_snapshot_source is null
    and oi.cost_snapshot_status is null
    and oi.unit_cost_snapshot is null
    and oi.total_cost_snapshot is null
  group by oi.id
)
update public.order_items oi
set
  unit_cost_snapshot = case
    when c.recipe_lines > 0 and c.invalid_lines = 0 and c.calculated_unit_cost is not null
      then round(c.calculated_unit_cost, 4)
    else null
  end,
  total_cost_snapshot = case
    when c.recipe_lines > 0 and c.invalid_lines = 0 and c.calculated_unit_cost is not null
      then round(round(c.calculated_unit_cost, 4) * oi.quantity, 4)
    else null
  end,
  cost_snapshot_status = case
    when c.recipe_lines > 0 and c.invalid_lines = 0 and c.calculated_unit_cost is not null
      then 'complete'
    else 'missing'
  end,
  cost_snapshot_source = 'backfill_client_confirmed',
  cost_snapshot_at = now()
from calculated c
where oi.id = c.id
  and oi.cost_snapshot_source is null
  and oi.cost_snapshot_status is null
  and oi.unit_cost_snapshot is null
  and oi.total_cost_snapshot is null;

-- La instantánea creada hoy antes de la confirmación del cliente ya tiene
-- su costo capturado; se conserva el importe y fecha original sin recalcular.
-- Sólo se actualiza su clasificación de procedencia.
update public.order_items oi
set cost_snapshot_source = 'backfill_client_confirmed'
from public.orders o
where o.id = oi.order_id
  and o.status <> 'cancelado'
  and o.created_at >= (timestamp '2026-10-31 00:00:00' at time zone 'America/Argentina/Buenos_Aires')
  and o.created_at <= now()
  and oi.cost_snapshot_source = 'backfill_current';

comment on column public.order_items.cost_snapshot_source is
  'order_insert: costo al crear la venta; order_edit: recalculado por edición; backfill_current: costo actual sin confirmación retroactiva; backfill_client_confirmed: costo de receta vigente según cliente desde 2026-10-31, reconstruido el 2026-11-09 (NO es instantánea capturada originalmente).';

-- Validación posterior esperada en el momento de migrar: 37 líneas válidas
-- con receta completa y 2 pendientes de receta; 1 línea previamente
-- reconstruida de hoy se reclasifica sin modificar su costo.

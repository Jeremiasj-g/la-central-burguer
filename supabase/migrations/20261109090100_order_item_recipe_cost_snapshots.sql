-- Instantánea histórica del costo de ingredientes para cada línea vendida.
-- Los márgenes son BRUTOS de producto; no equivalen a utilidad neta del negocio.
alter table public.order_items
  add column if not exists unit_cost_snapshot numeric(16,4),
  add column if not exists total_cost_snapshot numeric(16,4),
  add column if not exists cost_snapshot_status text,
  add column if not exists cost_snapshot_source text,
  add column if not exists cost_snapshot_at timestamptz;

alter table public.order_items
  drop constraint if exists order_items_cost_snapshot_status_check;
alter table public.order_items
  add constraint order_items_cost_snapshot_status_check
    check (cost_snapshot_status is null or cost_snapshot_status in ('complete','missing'));
alter table public.order_items
  drop constraint if exists order_items_cost_snapshot_source_check;
alter table public.order_items
  add constraint order_items_cost_snapshot_source_check
    check (cost_snapshot_source is null or cost_snapshot_source in ('order_insert','order_edit','backfill_current'));
alter table public.order_items
  add constraint order_items_cost_snapshot_consistency_check
    check (
      (cost_snapshot_status = 'complete' and unit_cost_snapshot is not null and total_cost_snapshot is not null
        and unit_cost_snapshot >= 0 and total_cost_snapshot >= 0)
      or (cost_snapshot_status is distinct from 'complete' and unit_cost_snapshot is null and total_cost_snapshot is null)
    );

create or replace function public.capture_order_item_cost_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cost_lines integer;
  incomplete_lines integer;
  calculated_cost numeric;
begin
  select count(*),
         count(*) filter (
           where pi.quantity is null or pi.quantity <= 0
           or i.id is null or i.unit_cost is null or i.unit_cost <= 0
           or not (
             pi.unit = i.unit
             or (i.unit::text = 'kg' and pi.unit::text = 'gr')
             or (i.unit::text = 'gr' and pi.unit::text = 'kg')
             or (i.unit::text = 'litro' and pi.unit::text = 'ml')
             or (i.unit::text = 'ml' and pi.unit::text = 'litro')
           )
         ),
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
         )
    into cost_lines, incomplete_lines, calculated_cost
    from public.product_ingredients pi
    left join public.ingredients i on i.id = pi.ingredient_id
   where pi.product_id = new.product_id;

  if new.product_id is not null and cost_lines > 0 and incomplete_lines = 0 and calculated_cost is not null then
    new.unit_cost_snapshot := round(calculated_cost,4);
    new.total_cost_snapshot := round(round(calculated_cost,4) * new.quantity,4);
    new.cost_snapshot_status := 'complete';
  else
    new.unit_cost_snapshot := null;
    new.total_cost_snapshot := null;
    new.cost_snapshot_status := 'missing';
  end if;

  new.cost_snapshot_source := case when tg_op = 'INSERT' then 'order_insert' else 'order_edit' end;
  new.cost_snapshot_at := now();
  return new;
end;
$$;

drop trigger if exists capture_order_item_cost_snapshot on public.order_items;
create trigger capture_order_item_cost_snapshot
before insert or update of product_id, quantity
on public.order_items for each row
execute function public.capture_order_item_cost_snapshot();

-- Activar para ventas ingresadas hoy antes de instalar este trigger.
-- Se identifican explícitamente como reconstrucción con COSTOS ACTUALES.
-- No inferir ni modificar costos históricos anteriores.
with calculated as (
  select oi.id,
         count(pi.id) as lines,
         count(pi.id) filter (
           where pi.quantity is null or pi.quantity <= 0 or i.id is null
             or i.unit_cost is null or i.unit_cost <= 0
             or not (
               pi.unit = i.unit
               or (i.unit::text = 'kg' and pi.unit::text = 'gr')
               or (i.unit::text = 'gr' and pi.unit::text = 'kg')
               or (i.unit::text = 'litro' and pi.unit::text = 'ml')
               or (i.unit::text = 'ml' and pi.unit::text = 'litro')
             )
         ) as invalid,
         sum(pi.quantity * i.unit_cost *
           case when pi.unit = i.unit then 1
                when i.unit::text='kg' and pi.unit::text='gr' then 0.001
                when i.unit::text='gr' and pi.unit::text='kg' then 1000
                when i.unit::text='litro' and pi.unit::text='ml' then 0.001
                when i.unit::text='ml' and pi.unit::text='litro' then 1000
                else null end
         ) as unit_cost
    from public.order_items oi
    join public.orders o on o.id=oi.order_id
    left join public.product_ingredients pi on pi.product_id=oi.product_id
    left join public.ingredients i on i.id=pi.ingredient_id
   where o.created_at >= (date_trunc('day',now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires')
     and oi.cost_snapshot_source is null
   group by oi.id
)
update public.order_items oi
   set unit_cost_snapshot = case when c.lines>0 and c.invalid=0 then round(c.unit_cost,4) else null end,
       total_cost_snapshot = case when c.lines>0 and c.invalid=0 then round(round(c.unit_cost,4)*oi.quantity,4) else null end,
       cost_snapshot_status = case when c.lines>0 and c.invalid=0 then 'complete' else 'missing' end,
       cost_snapshot_source = 'backfill_current',
       cost_snapshot_at = now()
  from calculated c where c.id=oi.id;

comment on column public.order_items.unit_cost_snapshot is 'Costo de receta por unidad al insertar la venta; NULL si receta incompleta. No es utilidad neta.';
comment on column public.order_items.cost_snapshot_source is 'order_insert exact; order_edit recalculado por edición; backfill_current reconstruido a costo actual para ventas de hoy.';

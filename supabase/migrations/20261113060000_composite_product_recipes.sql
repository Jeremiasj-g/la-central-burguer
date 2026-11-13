-- Recetas compuestas: una preparación puede usar ingredientes sueltos
-- y productos ya costeados. Solo se usa el COSTO, nunca el precio de venta.
-- No altera ventas históricas ni sus instantáneas de costo.

create table if not exists public.product_recipe_components (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  component_product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(12,3) not null check (quantity > 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_recipe_components_not_self check (product_id <> component_product_id),
  constraint product_recipe_components_unique unique (product_id,component_product_id)
);
create index if not exists product_recipe_components_component_idx
  on public.product_recipe_components(component_product_id);

alter table public.product_recipe_components enable row level security;
create policy "product_recipe_components_admin_read" on public.product_recipe_components
  for select to authenticated using ((select private.is_admin()));
create policy "product_recipe_components_admin_write" on public.product_recipe_components
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
revoke all on public.product_recipe_components from anon;
grant select,insert,update,delete on public.product_recipe_components to authenticated;

-- La función interna puede usar las recetas aunque el cliente anónimo
-- no tenga permiso SELECT sobre el catálogo de ingredientes.
create or replace function private.recipe_cost_unit(
  target_product_id uuid,
  visited uuid[] default array[]::uuid[]
) returns numeric
language plpgsql stable security definer set search_path = ''
as $$
declare
  line record;
  partial numeric := 0;
  component_cost numeric;
  total_lines integer := 0;
  multiplier numeric;
begin
  if target_product_id is null or target_product_id = any(visited)
     or cardinality(visited) >= 20 then return null; end if;
  if not exists (
    select 1 from public.products p
     where p.id=target_product_id and p.deleted_at is null
  ) then return null; end if;

  for line in
    select pi.quantity,pi.unit, i.id as ingredient_found,
           i.deleted_at, i.unit as ingredient_unit, i.unit_cost
      from public.product_ingredients pi
      left join public.ingredients i on i.id=pi.ingredient_id
     where pi.product_id=target_product_id
  loop
    total_lines := total_lines + 1;
    if line.ingredient_found is null or line.deleted_at is not null
       or line.quantity is null or line.quantity <= 0
       or line.unit_cost is null or line.unit_cost <= 0 then return null; end if;

    multiplier := case
      when line.unit = line.ingredient_unit then 1
      when line.ingredient_unit::text='kg' and line.unit::text='gr' then 0.001
      when line.ingredient_unit::text='gr' and line.unit::text='kg' then 1000
      when line.ingredient_unit::text='litro' and line.unit::text='ml' then 0.001
      when line.ingredient_unit::text='ml' and line.unit::text='litro' then 1000
      else null end;
    if multiplier is null then return null; end if;
    partial := partial + line.quantity * multiplier * line.unit_cost;
  end loop;

  for line in
    select rc.component_product_id,rc.quantity
      from public.product_recipe_components rc
     where rc.product_id=target_product_id
  loop
    total_lines := total_lines + 1;
    if line.quantity is null or line.quantity <= 0 then return null; end if;
    component_cost := private.recipe_cost_unit(
      line.component_product_id, visited || target_product_id
    );
    if component_cost is null or component_cost <= 0 then return null; end if;
    partial := partial + component_cost * line.quantity;
  end loop;

  if total_lines=0 or partial<=0 then return null; end if;
  return round(partial, 4);
end;
$$;
revoke all on function private.recipe_cost_unit(uuid,uuid[]) from public,anon,authenticated;

-- Misma captura existente por venta, ampliada para preparaciones compuestas.
create or replace function public.capture_order_item_cost_snapshot()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  unit_cost numeric;
begin
  unit_cost := private.recipe_cost_unit(new.product_id);
  if unit_cost is not null then
    new.unit_cost_snapshot := unit_cost;
    new.total_cost_snapshot := round(unit_cost * new.quantity,4);
    new.cost_snapshot_status := 'complete';
  else
    new.unit_cost_snapshot := null;
    new.total_cost_snapshot := null;
    new.cost_snapshot_status := 'missing';
  end if;

  new.cost_snapshot_source := case
    when tg_op='INSERT' then 'order_insert' else 'order_edit'
  end;
  new.cost_snapshot_at := now();
  return new;
end;
$$;

-- Guardado atómico: ingredientes + productos en una misma transacción.
create or replace function public.sync_product_recipe(
  target_product_id uuid,
  ingredient_rows jsonb default '[]'::jsonb,
  component_rows jsonb default '[]'::jsonb
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  item record;
  seen_ids uuid[];
  current_id uuid;
begin
  if not private.is_admin() then
    raise exception 'No autorizado.' using errcode='42501';
  end if;
  if jsonb_typeof(ingredient_rows) <> 'array'
     or jsonb_typeof(component_rows) <> 'array' then
    raise exception 'La receta no es válida.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(4573134);
  perform 1 from public.products p
    where p.id=target_product_id and p.deleted_at is null for update;
  if not found then
    raise exception 'Producto no encontrado.' using errcode='P0001';
  end if;

  -- Validaciones previas: sin duplicados, sin autoconsumo y sin ciclos.
  if exists (
    select 1 from (
      select item->>'ingredientId' as id
      from jsonb_array_elements(ingredient_rows) item
    ) x
    group by id having count(*)>1
  ) then raise exception 'No repitas un ingrediente en la receta.'; end if;
  if exists (
    select 1 from (
      select item->>'productId' as id
      from jsonb_array_elements(component_rows) item
    ) x
    group by id having count(*)>1
  ) then raise exception 'No repitas un producto en la receta.'; end if;

  for item in select value as data, ordinality as pos
                from jsonb_array_elements(ingredient_rows) with ordinality
  loop
    if not exists (select 1 from public.ingredients i
      where i.id::text=item.data->>'ingredientId' and i.deleted_at is null) then
      raise exception 'Uno de los ingredientes no existe o fue eliminado.';
    end if;
  end loop;

  for item in select value as data, ordinality as pos
                from jsonb_array_elements(component_rows) with ordinality
  loop
    current_id := (item.data->>'productId')::uuid;
    if current_id=target_product_id then
      raise exception 'Una receta no puede contenerse a sí misma.';
    end if;
    if not exists (
      select 1 from public.products p where p.id=current_id
        and p.deleted_at is null
    ) then raise exception 'Uno de los productos está eliminado.'; end if;
    if coalesce((item.data->>'quantity')::numeric,0)<=0 then
      raise exception 'Indicá una cantidad mayor que cero para los productos.';
    end if;
    -- Un componente no puede depender directa ni indirectamente del padre.
    with recursive dependency(id,path) as (
      select current_id, array[current_id]
      union all
      select pc.component_product_id,d.path||pc.component_product_id
        from dependency d
        join public.product_recipe_components pc on pc.product_id=d.id
       where not pc.component_product_id=any(d.path)
         and cardinality(d.path)<22
    )
    select array_agg(distinct id) into seen_ids from dependency;
    if target_product_id=any(seen_ids) then
      raise exception 'La combinación genera una dependencia circular entre productos.';
    end if;
    if private.recipe_cost_unit(current_id) is null then
      raise exception 'Solo podés usar productos con receta y costo completos.';
    end if;
  end loop;

  delete from public.product_ingredients where product_id=target_product_id;
  insert into public.product_ingredients(product_id,ingredient_id,quantity,unit,display_order)
  select target_product_id, i.id,
         case when nullif(item->>'quantity','') is null or
                   (item->>'quantity')::numeric<=0 then null
              else (item->>'quantity')::numeric end,
         coalesce(nullif(item->>'unit','')::public.ingredient_unit,i.unit),
         (ordinality-1)::integer
  from jsonb_array_elements(ingredient_rows) with ordinality as rows(item,ordinality)
  join public.ingredients i on i.id::text=item->>'ingredientId';

  delete from public.product_recipe_components where product_id=target_product_id;
  insert into public.product_recipe_components(product_id,component_product_id,quantity,display_order)
  select target_product_id,(item->>'productId')::uuid,
         (item->>'quantity')::numeric,(ordinality-1)::integer
  from jsonb_array_elements(component_rows) with ordinality as rows(item,ordinality);
end;
$$;
revoke all on function public.sync_product_recipe(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.sync_product_recipe(uuid,jsonb,jsonb) to authenticated;

comment on table public.product_recipe_components is
  'Productos completos utilizados como componentes de la receta de otro producto; el costo se obtiene recursivamente de sus ingredientes, nunca de su precio de venta.';

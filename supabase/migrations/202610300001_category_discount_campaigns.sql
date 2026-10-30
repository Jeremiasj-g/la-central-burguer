-- Campañas por categoría: fechas inclusivas en la zona horaria del negocio.
-- Los precios de lista en products.current_price nunca se modifican.
create table if not exists public.category_discount_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 100),
  category_ids uuid[] not null check (cardinality(category_ids) > 0 and array_position(category_ids, null) is null),
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent < 100),
  starts_on date not null,
  ends_on date not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_discount_dates_valid check (ends_on >= starts_on)
);
create index if not exists category_discount_by_category_dates
  on public.category_discount_campaigns(enabled, starts_on, ends_on);
create index if not exists category_discount_targets_gin
  on public.category_discount_campaigns using gin(category_ids);
alter table public.category_discount_campaigns enable row level security;

-- Impide que una campaña incluya IDs inexistentes, pese a usar selección múltiple.
create or replace function public.validate_discount_categories()
returns trigger language plpgsql security invoker set search_path = public
as $discount_validation$
begin
  if exists (
    select 1 from unnest(new.category_ids) selected(id)
    left join public.categories c on c.id = selected.id and c.deleted_at is null
    where c.id is null
  ) then
    raise exception 'Una o más categorías seleccionadas no existen.' using errcode = '22023';
  end if;
  return new;
end;
$discount_validation$;
drop trigger if exists validate_discount_categories on public.category_discount_campaigns;
create trigger validate_discount_categories
before insert or update of category_ids on public.category_discount_campaigns
for each row execute function public.validate_discount_categories();


create or replace function public.business_local_date()
returns date language sql stable security invoker
set search_path = public
as $$
  select (now() at time zone coalesce(
    (select timezone from public.business_config where id = 1),
    'America/Argentina/Cordoba'
  ))::date;
$$;

drop policy if exists category_discounts_public_read on public.category_discount_campaigns;
create policy category_discounts_public_read on public.category_discount_campaigns
  for select to anon, authenticated
  using (
    enabled
    and starts_on <= public.business_local_date()
    and ends_on >= public.business_local_date()
  );

drop policy if exists category_discounts_admin_manage on public.category_discount_campaigns;
create policy category_discounts_admin_manage on public.category_discount_campaigns
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select on public.category_discount_campaigns to anon, authenticated;
grant insert, update, delete on public.category_discount_campaigns to authenticated;
grant execute on function public.business_local_date() to anon, authenticated;

-- Cuando coinciden campañas de una categoría, se usa el mayor porcentaje.
-- No se acumulan descuentos.
create or replace function public.get_category_discount_percent(target_category_id uuid)
returns numeric language sql stable security invoker
set search_path = public
as $$
  select coalesce(max(discount_percent), 0)
  from public.category_discount_campaigns
  where target_category_id = any(category_ids)
    and enabled
    and starts_on <= public.business_local_date()
    and ends_on >= public.business_local_date();
$$;

create or replace function public.discounted_product_price(target_category_id uuid, base_price numeric)
returns numeric language sql stable security invoker
set search_path = public
as $$
  select round(
    greatest(coalesce(base_price, 0), 0)
    * (1 - public.get_category_discount_percent(target_category_id) / 100),
    0
  );
$$;
grant execute on function public.get_category_discount_percent(uuid) to anon, authenticated;
grant execute on function public.discounted_product_price(uuid,numeric) to anon, authenticated;

-- Actualiza las dos rutas de creación de pedido que ya existen SIN cambiar
-- sus validaciones de cliente, envío, disponibilidad, ni sus permisos actuales.
-- Ambas calculan total e ítems a partir del mismo precio promocional validado.
do $migration$
declare
  existing_definition text;
  changed_definition text;
  function_name text;
begin
  foreach function_name in array array['create_public_order', 'create_public_order_from_route'] loop
    select pg_get_functiondef(p.oid) into existing_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = function_name
      and pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

    if existing_definition is null then
      raise exception 'No se encontró la función %', function_name;
    end if;
    if position('public.discounted_product_price(' in existing_definition) > 0 then
      continue;
    end if;
    if position('requested_product.current_price * requested_quantity' in existing_definition) = 0
      or position('requested_product.current_price,' in existing_definition) = 0 then
      raise exception 'El formato de % cambió; revisión manual requerida', function_name;
    end if;

    changed_definition := replace(existing_definition,
      'requested_product.current_price * requested_quantity',
      'public.discounted_product_price(requested_product.category_id, requested_product.current_price) * requested_quantity');
    changed_definition := replace(changed_definition,
      'requested_product.current_price,',
      'public.discounted_product_price(requested_product.category_id, requested_product.current_price),');
    changed_definition := replace(changed_definition,
      'requested_product.is_promotion,',
      '(requested_product.is_promotion OR public.get_category_discount_percent(requested_product.category_id) > 0),');
    execute changed_definition;
  end loop;
end;
$migration$;

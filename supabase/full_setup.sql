-- La Central Burger - esquema inicial completo para Supabase/PostgreSQL
-- Fecha: 2026-07-31
-- Ejecutar con Supabase CLI (db push) o desde SQL Editor.

begin;

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists citext;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('admin', 'staff');
create type public.ingredient_type as enum ('proteina', 'panificados', 'lacteos', 'verduras', 'insumos', 'bebidas', 'otros');
create type public.ingredient_unit as enum ('kg', 'gr', 'unidad', 'litro', 'ml', 'paquete');
create type public.order_status as enum ('pendiente', 'aceptado', 'en_preparacion', 'listo', 'en_camino', 'entregado', 'cancelado');
create type public.delivery_method as enum ('retiro_local', 'delivery');
create type public.payment_method_code as enum ('efectivo', 'transferencia');

create sequence if not exists public.order_code_seq start with 1 increment by 1;

-- -----------------------------------------------------------------------------
-- Utilidades y autorización
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(unaccent(value)), '[^a-z0-9]+', '-', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- Usuarios administrativos
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.active = true
  );
$$;

grant execute on function private.is_admin() to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Configuración del negocio
-- -----------------------------------------------------------------------------

create table public.business_config (
  id smallint primary key default 1 check (id = 1),
  business_name text not null,
  logo_url text not null default '',
  logo_path text,
  hero_description text not null default '',
  whatsapp_number text not null,
  transfer_alias text not null default '',
  transfer_cvu text not null default '',
  address text not null default '',
  specialty text not null default '',
  timezone text not null default 'America/Argentina/Cordoba',
  is_open boolean not null default true,
  auto_schedule_enabled boolean not null default false,
  auto_open_time time not null default '20:00',
  auto_close_time time not null default '00:00',
  store_latitude numeric(10,7) check (store_latitude is null or store_latitude between -90 and 90),
  store_longitude numeric(10,7) check (store_longitude is null or store_longitude between -180 and 180),
  delivery_base_fee numeric(12,2) not null default 0 check (delivery_base_fee >= 0),
  delivery_price_per_km numeric(12,2) not null default 0 check (delivery_price_per_km >= 0),
  delivery_max_distance_km numeric(8,2) not null default 0 check (delivery_max_distance_km >= 0),
  delivery_rounding_value numeric(12,2) not null default 100 check (delivery_rounding_value > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger business_config_set_updated_at
before update on public.business_config
for each row execute function public.set_updated_at();



create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  code public.payment_method_code not null unique,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name citext not null,
  slug text not null,
  description text,
  icon_name text,
  image_url text,
  display_order integer not null default 0,
  active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.categories_prepare_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or btrim(new.slug) = '' or (tg_op = 'UPDATE' and new.name is distinct from old.name and new.slug = old.slug) then
    new.slug = public.slugify(new.name::text);
  end if;
  return new;
end;
$$;

create trigger categories_prepare_slug
before insert or update on public.categories
for each row execute function public.categories_prepare_slug();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create unique index categories_name_unique_idx on public.categories (name) where deleted_at is null;
create unique index categories_slug_unique_idx on public.categories (slug) where deleted_at is null;
create index categories_active_order_idx on public.categories (active, display_order) where deleted_at is null;

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name citext not null,
  type public.ingredient_type not null default 'otros',
  unit public.ingredient_unit not null default 'unidad',
  supplier text,
  active boolean not null default true,
  last_updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger ingredients_set_updated_at
before update on public.ingredients
for each row execute function public.set_updated_at();

create unique index ingredients_name_unique_idx on public.ingredients (name) where deleted_at is null;
create index ingredients_active_name_idx on public.ingredients (active, name) where deleted_at is null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on update cascade on delete restrict,
  name citext not null,
  slug text not null,
  description text not null default '',
  image_url text not null default '/images/productos/burger-simple.svg',
  image_path text,
  current_price numeric(12,2) not null check (current_price >= 0),
  active boolean not null default true,
  available boolean not null default true,
  featured boolean not null default false,
  is_promotion boolean not null default false,
  display_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.products_prepare_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.slug is null or btrim(new.slug) = '' or (tg_op = 'UPDATE' and new.name is distinct from old.name and new.slug = old.slug) then
    new.slug = public.slugify(new.name::text);
  end if;
  return new;
end;
$$;

create trigger products_prepare_slug
before insert or update on public.products
for each row execute function public.products_prepare_slug();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create unique index products_slug_unique_idx on public.products (slug) where deleted_at is null;
create unique index products_category_name_unique_idx on public.products (category_id, name) where deleted_at is null;
create index products_catalog_idx on public.products (active, available, category_id, display_order) where deleted_at is null;
create index products_featured_idx on public.products (featured) where deleted_at is null and active = true;

create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,4) check (quantity is null or quantity >= 0),
  unit public.ingredient_unit,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (product_id, ingredient_id)
);

create trigger product_ingredients_set_updated_at
before update on public.product_ingredients
for each row execute function public.set_updated_at();

create index product_ingredients_product_idx on public.product_ingredients(product_id);
create index product_ingredients_ingredient_idx on public.product_ingredients(ingredient_id);

create or replace function public.sync_product_ingredients(target_product_id uuid, ingredient_rows jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;
  if jsonb_typeof(ingredient_rows) <> 'array' then
    raise exception 'La lista de ingredientes no es válida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.products p where p.id = target_product_id and p.deleted_at is null) then
    raise exception 'Producto no encontrado.' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(ingredient_rows) item
    where not exists (
      select 1 from public.ingredients i
      where i.id::text = item ->> 'ingredientId' and i.deleted_at is null
    )
  ) then
    raise exception 'Uno de los ingredientes no existe o fue eliminado.' using errcode = 'P0001';
  end if;

  delete from public.product_ingredients where product_id = target_product_id;

  insert into public.product_ingredients(product_id, ingredient_id, quantity, unit, display_order)
  select
    target_product_id,
    i.id,
    case
      when nullif(item ->> 'quantity', '') is null then null
      when (item ->> 'quantity')::numeric <= 0 then null
      else (item ->> 'quantity')::numeric
    end,
    coalesce(nullif(item ->> 'unit', '')::public.ingredient_unit, i.unit),
    coalesce(nullif(item ->> 'displayOrder', '')::integer, ordinality::integer - 1)
  from jsonb_array_elements(ingredient_rows) with ordinality as rows(item, ordinality)
  join public.ingredients i on i.id::text = item ->> 'ingredientId';
end;
$$;

revoke all on function public.sync_product_ingredients(uuid, jsonb) from public;
grant execute on function public.sync_product_ingredients(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Clientes, pedidos y ventas
-- -----------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  normalized_phone text not null unique,
  email text,
  default_address text,
  default_latitude numeric(10,7),
  default_longitude numeric(10,7),
  order_count integer not null default 0 check (order_count >= 0),
  last_order_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  delivery_method public.delivery_method not null,
  address text,
  customer_latitude numeric(10,7) check (customer_latitude is null or customer_latitude between -90 and 90),
  customer_longitude numeric(10,7) check (customer_longitude is null or customer_longitude between -180 and 180),
  delivery_distance_km numeric(8,3) check (delivery_distance_km is null or delivery_distance_km >= 0),
  delivery_maps_url text,
  payment_method public.payment_method_code not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_cost numeric(12,2) not null default 0 check (delivery_cost >= 0),
  total numeric(12,2) generated always as (subtotal + delivery_cost) stored,
  status public.order_status not null default 'aceptado',
  notes text,
  source text not null default 'web' check (source in ('web', 'admin', 'import')),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create index orders_created_at_idx on public.orders(created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_delivery_idx on public.orders(delivery_method, created_at desc);
create index orders_payment_idx on public.orders(payment_method, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  product_name text not null,
  category_name text,
  image_url text,
  is_promotion boolean not null default false,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total numeric(12,2) generated always as (quantity * unit_price) stored,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);
create index order_items_category_idx on public.order_items(category_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  description text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index order_status_history_order_idx on public.order_status_history(order_id, created_at);

create table public.order_notification_reads (
  admin_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  read_at timestamptz not null default timezone('utc', now()),
  primary key (admin_id, order_id)
);

create index order_notification_reads_admin_idx on public.order_notification_reads(admin_id, read_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_table_record_idx on public.audit_logs(table_name, record_id);

-- -----------------------------------------------------------------------------
-- Reglas automáticas de pedidos y auditoría
-- -----------------------------------------------------------------------------

create or replace function public.generate_order_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  next_number bigint;
  local_date date;
begin
  next_number := nextval('public.order_code_seq');
  local_date := (now() at time zone 'America/Argentina/Cordoba')::date;
  return 'LCB-' || to_char(local_date, 'YYMMDD') || '-' || lpad(next_number::text, 6, '0');
end;
$$;

create or replace function public.orders_prepare_status_dates()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'aceptado' and new.accepted_at is null then
    new.accepted_at = timezone('utc', now());
  end if;
  if new.status = 'cancelado' and new.cancelled_at is null then
    new.cancelled_at = timezone('utc', now());
  end if;
  if new.status <> 'cancelado' then
    new.cancelled_at = null;
  end if;
  return new;
end;
$$;

create trigger orders_prepare_status_dates
before insert or update of status on public.orders
for each row execute function public.orders_prepare_status_dates();

create or replace function public.orders_write_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, status, description, changed_by)
    values (
      new.id,
      new.status,
      case when new.source = 'web' then 'Pedido aceptado desde el sitio web.' else 'Pedido creado desde el panel administrativo.' end,
      auth.uid()
    );
  elsif new.status is distinct from old.status then
    insert into public.order_status_history(order_id, status, description, changed_by)
    values (
      new.id,
      new.status,
      'Estado actualizado a ' || replace(new.status::text, '_', ' ') || '.',
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger orders_write_status_history
after insert or update of status on public.orders
for each row execute function public.orders_write_status_history();

create or replace function public.customers_refresh_order_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is not null then
    update public.customers
    set order_count = (select count(*) from public.orders o where o.customer_id = new.customer_id),
        last_order_at = greatest(coalesce(last_order_at, new.created_at), new.created_at),
        updated_at = timezone('utc', now())
    where id = new.customer_id;
  end if;
  return new;
end;
$$;

create trigger orders_refresh_customer_stats
after insert on public.orders
for each row execute function public.customers_refresh_order_stats();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  row_id text;
begin
  row_id := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'));
  insert into public.audit_logs(actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger categories_audit after insert or update or delete on public.categories for each row execute function public.audit_row_change();
create trigger products_audit after insert or update or delete on public.products for each row execute function public.audit_row_change();
create trigger ingredients_audit after insert or update or delete on public.ingredients for each row execute function public.audit_row_change();
create trigger product_ingredients_audit after insert or update or delete on public.product_ingredients for each row execute function public.audit_row_change();
create trigger business_config_audit after insert or update or delete on public.business_config for each row execute function public.audit_row_change();
create trigger payment_methods_audit after insert or update or delete on public.payment_methods for each row execute function public.audit_row_change();
create trigger orders_audit after insert or update or delete on public.orders for each row execute function public.audit_row_change();

-- -----------------------------------------------------------------------------
-- Cálculo de apertura y delivery
-- -----------------------------------------------------------------------------

create or replace function public.is_business_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  config public.business_config%rowtype;
  local_time time;
begin
  select * into config from public.business_config where id = 1;
  if not found then
    return false;
  end if;
  if not config.auto_schedule_enabled then
    return config.is_open;
  end if;
  local_time := (now() at time zone config.timezone)::time;
  if config.auto_open_time = config.auto_close_time then
    return true;
  elsif config.auto_open_time < config.auto_close_time then
    return local_time >= config.auto_open_time and local_time < config.auto_close_time;
  else
    return local_time >= config.auto_open_time or local_time < config.auto_close_time;
  end if;
end;
$$;

grant execute on function public.is_business_open() to anon, authenticated;

create or replace function public.distance_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
strict
set search_path = public
as $$
  select round((
    6371 * 2 * asin(
      sqrt(
        power(sin(radians((lat2 - lat1)::double precision) / 2), 2)
        + cos(radians(lat1::double precision))
        * cos(radians(lat2::double precision))
        * power(sin(radians((lng2 - lng1)::double precision) / 2), 2)
      )
    )
  )::numeric, 3);
$$;

create or replace function public.calculate_delivery_quote(customer_lat numeric, customer_lng numeric)
returns table(distance_km numeric, delivery_cost numeric, is_within_range boolean, maps_url text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  config public.business_config%rowtype;
  calculated_distance numeric;
  raw_cost numeric;
begin
  if customer_lat not between -90 and 90 or customer_lng not between -180 and 180 then
    raise exception 'Las coordenadas ingresadas no son válidas.' using errcode = '22023';
  end if;

  select * into config from public.business_config where id = 1;
  if not found or config.store_latitude is null or config.store_longitude is null then
    return;
  end if;

  calculated_distance := public.distance_km(config.store_latitude, config.store_longitude, customer_lat, customer_lng);
  raw_cost := config.delivery_base_fee + (calculated_distance * config.delivery_price_per_km);

  distance_km := calculated_distance;
  is_within_range := config.delivery_max_distance_km <= 0 or calculated_distance <= config.delivery_max_distance_km;
  delivery_cost := case
    when is_within_range then ceil(raw_cost / config.delivery_rounding_value) * config.delivery_rounding_value
    else 0
  end;
  maps_url := 'https://www.google.com/maps?q=' || customer_lat::text || ',' || customer_lng::text;
  return next;
end;
$$;

grant execute on function public.calculate_delivery_quote(numeric, numeric) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Pedido público atómico (el navegador no puede falsificar precios)
-- -----------------------------------------------------------------------------

create or replace function private.get_order_json(target_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'orderCode', o.order_code,
    'customerId', o.customer_id,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone,
    'customerEmail', o.customer_email,
    'deliveryMethod', o.delivery_method,
    'address', o.address,
    'customerLat', o.customer_latitude,
    'customerLng', o.customer_longitude,
    'deliveryDistanceKm', o.delivery_distance_km,
    'deliveryMapsUrl', o.delivery_maps_url,
    'paymentMethod', o.payment_method,
    'subtotal', o.subtotal,
    'deliveryCost', o.delivery_cost,
    'total', o.total,
    'status', o.status,
    'notes', o.notes,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'productName', oi.product_name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'total', oi.total,
        'note', oi.note
      ) order by oi.created_at)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', osh.status,
        'date', osh.created_at,
        'description', osh.description
      ) order by osh.created_at)
      from public.order_status_history osh where osh.order_id = o.id
    ), '[]'::jsonb),
    'createdAt', o.created_at,
    'updatedAt', o.updated_at
  )
  from public.orders o
  where o.id = target_order_id;
$$;

revoke all on function private.get_order_json(uuid) from public;

create or replace function public.create_public_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  customer_name text := left(btrim(coalesce(payload ->> 'customerName', '')), 120);
  customer_phone text := left(btrim(coalesce(payload ->> 'customerPhone', '')), 40);
  normalized_phone text;
  chosen_delivery public.delivery_method;
  chosen_payment public.payment_method_code;
  delivery_address text := nullif(left(btrim(coalesce(payload ->> 'address', '')), 300), '');
  latitude numeric;
  longitude numeric;
  distance numeric;
  quoted_delivery_cost numeric := 0;
  maps_url text;
  within_range boolean := false;
  customer_record_id uuid;
  new_order_id uuid;
  new_order_code text;
  calculated_subtotal numeric := 0;
  requested_item jsonb;
  requested_product public.products%rowtype;
  requested_quantity integer;
  requested_note text;
  item_count integer := 0;
begin
  if not public.is_business_open() then
    raise exception 'El local está cerrado. Intentá nuevamente dentro del horario de atención.' using errcode = 'P0001';
  end if;

  if customer_name = '' then
    raise exception 'El nombre del cliente es obligatorio.' using errcode = '22023';
  end if;
  if customer_phone = '' then
    raise exception 'El teléfono del cliente es obligatorio.' using errcode = '22023';
  end if;

  normalized_phone := regexp_replace(customer_phone, '[^0-9]', '', 'g');
  if length(normalized_phone) < 6 then
    raise exception 'El teléfono ingresado no es válido.' using errcode = '22023';
  end if;

  begin
    chosen_delivery := (payload ->> 'deliveryMethod')::public.delivery_method;
    chosen_payment := (payload ->> 'paymentMethod')::public.payment_method_code;
  exception when others then
    raise exception 'Método de entrega o de pago inválido.' using errcode = '22023';
  end;

  if not exists (
    select 1 from public.payment_methods pm
    where pm.code = chosen_payment and pm.active = true
  ) then
    raise exception 'El método de pago seleccionado no está disponible.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'El pedido no contiene productos.' using errcode = '22023';
  end if;
  if jsonb_array_length(payload -> 'items') > 50 then
    raise exception 'El pedido contiene demasiadas líneas de productos.' using errcode = '22023';
  end if;

  -- Bloqueamos productos/categorías en orden estable para que precio y disponibilidad
  -- no cambien entre el cálculo del subtotal y la creación de los ítems.
  perform p.id
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.id::text in (
    select item ->> 'productId' from jsonb_array_elements(payload -> 'items') item
  )
  order by p.id
  for share of p, c;

  if chosen_delivery = 'delivery' then
    latitude := nullif(payload ->> 'customerLat', '')::numeric;
    longitude := nullif(payload ->> 'customerLng', '')::numeric;
    if delivery_address is null and (latitude is null or longitude is null) then
      raise exception 'Ingresá una dirección o adjuntá la ubicación actual.' using errcode = '22023';
    end if;
    if latitude is not null and longitude is not null then
      select q.distance_km, q.delivery_cost, q.is_within_range, q.maps_url
        into distance, quoted_delivery_cost, within_range, maps_url
      from public.calculate_delivery_quote(latitude, longitude) q;
      if not found then
        quoted_delivery_cost := 0;
      end if;
    end if;
  else
    quoted_delivery_cost := 0;
    delivery_address := null;
    latitude := null;
    longitude := null;
    distance := null;
    maps_url := null;
  end if;

  insert into public.customers (
    full_name, phone, normalized_phone, email, default_address, default_latitude, default_longitude
  ) values (
    customer_name,
    customer_phone,
    normalized_phone,
    nullif(left(btrim(coalesce(payload ->> 'customerEmail', '')), 160), ''),
    delivery_address,
    latitude,
    longitude
  )
  on conflict (normalized_phone) do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = coalesce(excluded.email, public.customers.email),
    default_address = coalesce(excluded.default_address, public.customers.default_address),
    default_latitude = coalesce(excluded.default_latitude, public.customers.default_latitude),
    default_longitude = coalesce(excluded.default_longitude, public.customers.default_longitude),
    updated_at = timezone('utc', now())
  returning id into customer_record_id;

  new_order_code := public.generate_order_code();

  -- Calculamos subtotal con precios reales de la base, no con el valor enviado por el navegador.
  for requested_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    requested_quantity := greatest(1, least(99, coalesce((requested_item ->> 'quantity')::integer, 1)));
    select p.* into requested_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id::text = requested_item ->> 'productId'
      and p.active = true
      and p.available = true
      and p.deleted_at is null
      and c.active = true
      and c.deleted_at is null;

    if not found then
      raise exception 'Uno de los productos ya no se encuentra disponible.' using errcode = 'P0001';
    end if;

    calculated_subtotal := calculated_subtotal + (requested_product.current_price * requested_quantity);
    item_count := item_count + 1;
  end loop;

  if item_count = 0 then
    raise exception 'El pedido no contiene productos válidos.' using errcode = '22023';
  end if;

  insert into public.orders (
    order_code,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    delivery_method,
    address,
    customer_latitude,
    customer_longitude,
    delivery_distance_km,
    delivery_maps_url,
    payment_method,
    subtotal,
    delivery_cost,
    status,
    notes,
    source
  ) values (
    new_order_code,
    customer_record_id,
    customer_name,
    customer_phone,
    nullif(left(btrim(coalesce(payload ->> 'customerEmail', '')), 160), ''),
    chosen_delivery,
    delivery_address,
    latitude,
    longitude,
    distance,
    maps_url,
    chosen_payment,
    calculated_subtotal,
    quoted_delivery_cost,
    'aceptado',
    nullif(left(btrim(coalesce(payload ->> 'notes', '')), 1000), ''),
    'web'
  ) returning id into new_order_id;

  for requested_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    requested_quantity := greatest(1, least(99, coalesce((requested_item ->> 'quantity')::integer, 1)));
    requested_note := nullif(left(btrim(coalesce(requested_item ->> 'note', '')), 500), '');

    select p.* into requested_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id::text = requested_item ->> 'productId'
      and p.active = true
      and p.available = true
      and p.deleted_at is null
      and c.active = true
      and c.deleted_at is null;

    insert into public.order_items (
      order_id, product_id, category_id, product_name, category_name, image_url,
      is_promotion, quantity, unit_price, note
    )
    select
      new_order_id,
      requested_product.id,
      requested_product.category_id,
      requested_product.name::text,
      c.name::text,
      requested_product.image_url,
      requested_product.is_promotion,
      requested_quantity,
      requested_product.current_price,
      requested_note
    from public.categories c
    where c.id = requested_product.category_id;
  end loop;

  return private.get_order_json(new_order_id);
end;
$$;

revoke all on function public.create_public_order(jsonb) from public;
grant execute on function public.create_public_order(jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard administrativo
-- -----------------------------------------------------------------------------

create or replace function public.get_dashboard_stats(days_back integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  result jsonb;
  tz text;
  today_start timestamptz;
  range_start timestamptz;
begin
  if not private.is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select timezone into tz from public.business_config where id = 1;
  tz := coalesce(tz, 'America/Argentina/Cordoba');
  today_start := date_trunc('day', now() at time zone tz) at time zone tz;
  range_start := today_start - make_interval(days => greatest(days_back - 1, 0));

  with valid_orders as (
    select * from public.orders where status <> 'cancelado'
  ),
  today_orders as (
    select * from valid_orders where created_at >= today_start
  ),
  recent_orders as (
    select * from public.orders where created_at >= range_start
  )
  select jsonb_build_object(
    'metrics', jsonb_build_array(
      jsonb_build_object(
        'label', 'Ventas del día',
        'value', coalesce((select sum(total) from today_orders), 0),
        'hint', (select count(*) from today_orders)::text || ' pedidos registrados',
        'trend', ''
      ),
      jsonb_build_object(
        'label', 'Total pedidos',
        'value', (select count(*) from public.orders)::text,
        'hint', 'Pedidos registrados',
        'trend', (select count(*) from public.orders where status = 'aceptado')::text || ' aceptados'
      ),
      jsonb_build_object(
        'label', 'Pedidos cancelados',
        'value', (select count(*) from public.orders where status = 'cancelado')::text,
        'hint', 'Del total de pedidos',
        'trend', ''
      ),
      jsonb_build_object(
        'label', 'Ticket promedio',
        'value', coalesce((select avg(total) from valid_orders), 0),
        'hint', 'Promedio por pedido',
        'trend', ''
      )
    ),
    'salesEvolution', coalesce((
      select jsonb_agg(jsonb_build_object('name', label, 'value', revenue, 'orders', orders_count) order by day_value)
      from (
        select
          gs::date day_value,
          to_char(gs, 'Dy') label,
          coalesce(sum(o.total), 0) revenue,
          count(o.id) orders_count
        from generate_series((today_start at time zone tz)::date - 6, (today_start at time zone tz)::date, interval '1 day') gs
        left join valid_orders o on (o.created_at at time zone tz)::date = gs::date
        group by gs
      ) q
    ), '[]'::jsonb),
    'revenueByDay', coalesce((
      select jsonb_agg(jsonb_build_object('name', label, 'value', revenue, 'revenue', revenue) order by day_value)
      from (
        select
          gs::date day_value,
          to_char(gs, 'DD/MM') label,
          coalesce(sum(o.total), 0) revenue
        from generate_series((range_start at time zone tz)::date, (today_start at time zone tz)::date, interval '1 day') gs
        left join valid_orders o on (o.created_at at time zone tz)::date = gs::date
        group by gs
      ) q
    ), '[]'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(jsonb_build_object('name', product_name, 'value', quantity) order by quantity desc)
      from (
        select oi.product_name, sum(oi.quantity)::numeric quantity
        from public.order_items oi
        join valid_orders o on o.id = oi.order_id
        where o.created_at >= range_start
        group by oi.product_name
        order by quantity desc
        limit 8
      ) q
    ), '[]'::jsonb),
    'salesByCategory', coalesce((
      select jsonb_agg(jsonb_build_object('name', category_name, 'value', revenue) order by revenue desc)
      from (
        select coalesce(oi.category_name, 'Sin categoría') category_name, sum(oi.total)::numeric revenue
        from public.order_items oi
        join valid_orders o on o.id = oi.order_id
        where o.created_at >= range_start
        group by coalesce(oi.category_name, 'Sin categoría')
      ) q
    ), '[]'::jsonb),
    'deliveryMethods', coalesce((
      select jsonb_agg(jsonb_build_object('name', case delivery_method when 'delivery' then 'Delivery' else 'Retiro local' end, 'value', count) order by delivery_method)
      from (
        select delivery_method, count(*)::numeric count
        from valid_orders
        where created_at >= range_start
        group by delivery_method
      ) q
    ), '[]'::jsonb),
    'topPromotions', coalesce((
      select jsonb_agg(jsonb_build_object('name', product_name, 'value', quantity) order by quantity desc)
      from (
        select oi.product_name, sum(oi.quantity)::numeric quantity
        from public.order_items oi
        join valid_orders o on o.id = oi.order_id
        where o.created_at >= range_start and oi.is_promotion = true
        group by oi.product_name
        order by quantity desc
        limit 8
      ) q
    ), '[]'::jsonb),
    'paymentMethods', coalesce((
      select jsonb_agg(jsonb_build_object('name', case payment_method when 'efectivo' then 'Efectivo' else 'Transferencia' end, 'value', count) order by payment_method)
      from (
        select payment_method, count(*)::numeric count
        from valid_orders
        where created_at >= range_start
        group by payment_method
      ) q
    ), '[]'::jsonb),
    'salesByHour', coalesce((
      select jsonb_agg(jsonb_build_object('name', lpad(hour_value::text, 2, '0') || 'hs', 'value', count) order by hour_value)
      from (
        select extract(hour from created_at at time zone tz)::integer hour_value, count(*)::numeric count
        from valid_orders
        where created_at >= range_start
        group by 1
      ) q
    ), '[]'::jsonb),
    'recentOrders', coalesce((
      select jsonb_agg(private.get_order_json(o.id) order by o.created_at desc)
      from (select id, created_at from public.orders order by created_at desc limit 6) o
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_dashboard_stats(integer) from public;
grant execute on function public.get_dashboard_stats(integer) to authenticated;

-- Vista básica de ventas (no reemplaza al futuro módulo de reportes)
create or replace view public.sales_ledger
with (security_invoker = true)
as
select
  o.id,
  o.order_code,
  o.customer_name,
  o.customer_phone,
  o.delivery_method,
  o.payment_method,
  o.subtotal,
  o.delivery_cost,
  o.total,
  o.status,
  o.created_at,
  o.updated_at
from public.orders o
where o.status <> 'cancelado';

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.business_config enable row level security;
alter table public.payment_methods enable row level security;
alter table public.categories enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_notification_reads enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self_or_admin on public.profiles
for select to authenticated
using ((select auth.uid()) = id or (select private.is_admin()));
create policy profiles_update_admin on public.profiles
for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy business_config_public_read on public.business_config
for select to anon, authenticated using (true);
create policy business_config_admin_update on public.business_config
for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));



create policy payment_methods_public_active_read on public.payment_methods
for select to anon using (active = true);
create policy payment_methods_authenticated_read on public.payment_methods
for select to authenticated using (active = true or (select private.is_admin()));
create policy payment_methods_admin_write on public.payment_methods
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy categories_public_active_read on public.categories
for select to anon using (deleted_at is null and active = true);
create policy categories_authenticated_read on public.categories
for select to authenticated using ((deleted_at is null and active = true) or (select private.is_admin()));
create policy categories_admin_write on public.categories
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy ingredients_admin_read on public.ingredients
for select to authenticated using ((select private.is_admin()));
create policy ingredients_admin_all on public.ingredients
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy products_public_active_read on public.products
for select to anon using (
  deleted_at is null
  and active = true
  and exists (
    select 1 from public.categories c
    where c.id = category_id and c.deleted_at is null and c.active = true
  )
);
create policy products_authenticated_read on public.products
for select to authenticated using (
  (
    deleted_at is null
    and active = true
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.deleted_at is null and c.active = true
    )
  )
  or (select private.is_admin())
);
create policy products_admin_write on public.products
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy product_ingredients_public_read on public.product_ingredients
for select to anon using (exists (
  select 1
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.id = product_id
    and p.deleted_at is null
    and p.active = true
    and c.deleted_at is null
    and c.active = true
));
create policy product_ingredients_authenticated_read on public.product_ingredients
for select to authenticated using (
  exists (
    select 1
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id = product_id
      and p.deleted_at is null
      and p.active = true
      and c.deleted_at is null
      and c.active = true
  )
  or (select private.is_admin())
);
create policy product_ingredients_admin_write on public.product_ingredients
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy customers_admin_all on public.customers
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy orders_admin_all on public.orders
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy order_items_admin_all on public.order_items
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy order_history_admin_all on public.order_status_history
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy notification_reads_own on public.order_notification_reads
for all to authenticated
using ((select auth.uid()) = admin_id and (select private.is_admin()))
with check ((select auth.uid()) = admin_id and (select private.is_admin()));

create policy audit_logs_admin_read on public.audit_logs
for select to authenticated using ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- Grants mínimos para Data API
-- -----------------------------------------------------------------------------

-- El acceso real queda limitado además por las políticas RLS anteriores.
revoke all on public.profiles, public.business_config, public.payment_methods, public.categories,
  public.ingredients, public.products, public.product_ingredients, public.customers, public.orders,
  public.order_items, public.order_status_history, public.order_notification_reads, public.audit_logs
  from anon, authenticated;

-- Catálogo/configuración pública: lectura solamente. Los pedidos públicos se crean mediante RPC.
grant select on public.business_config, public.payment_methods, public.categories, public.products,
  public.product_ingredients to anon;
grant select on public.business_config, public.payment_methods, public.categories, public.products,
  public.product_ingredients to authenticated;

-- Panel administrativo: RLS verifica que el usuario sea administrador activo.
grant select, insert, update, delete on public.profiles, public.business_config, public.payment_methods,
  public.categories, public.ingredients, public.products, public.product_ingredients, public.customers,
  public.orders, public.order_items, public.order_status_history, public.order_notification_reads,
  public.audit_logs to authenticated;

grant select on public.sales_ledger to authenticated;
grant usage, select on sequence public.order_code_seq to authenticated;

-- -----------------------------------------------------------------------------
-- Storage de imágenes de productos
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 3145728, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

create policy product_images_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and (select private.is_admin()));

create policy product_images_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()))
with check (bucket_id = 'product-images' and (select private.is_admin()));

create policy product_images_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and (select private.is_admin()));


-- Logo e identidad visual del negocio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-assets', 'business-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy business_assets_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'business-assets');

create policy business_assets_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'business-assets' and (select private.is_admin()));

create policy business_assets_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'business-assets' and (select private.is_admin()))
with check (bucket_id = 'business-assets' and (select private.is_admin()));

create policy business_assets_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'business-assets' and (select private.is_admin()));

-- Realtime para pedidos, catálogo y configuración.
do $$
declare
  target_table text;
begin
  foreach target_table in array array['orders','products','categories','ingredients','product_ingredients','business_config','payment_methods']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end;
$$;

commit;
-- Datos iniciales de La Central Burger. Puede ejecutarse varias veces.
-- No crea pedidos ficticios: el historial comienza con pedidos reales.
begin;

insert into public.business_config (
  id, business_name, hero_description, whatsapp_number, transfer_alias, transfer_cvu, address, specialty,
  timezone, is_open, auto_schedule_enabled, auto_open_time, auto_close_time, store_latitude, store_longitude,
  delivery_base_fee, delivery_price_per_km, delivery_max_distance_km, delivery_rounding_value
) values (
  1, 'La Central Burger', 'Hamburguesas, lomitos, sándwichs de milanesa, figazzas, pizzas y milanesas XXL. Sabor bien cargado, papas fritas y pedidos rápidos por WhatsApp.', '543794752707', 'jeremiasjg.mp', '0000003100068262525673', 'Madariaga 246', 'Papas incluidas',
  'America/Argentina/Cordoba', true, true, '20:00'::time, '00:00'::time, -27.4692, -58.8306,
  800, 400, 8, 100
) on conflict (id) do update set
  business_name = excluded.business_name, hero_description = excluded.hero_description, whatsapp_number = excluded.whatsapp_number,
  transfer_alias = excluded.transfer_alias, transfer_cvu = excluded.transfer_cvu, address = excluded.address, specialty = excluded.specialty,
  timezone = excluded.timezone, is_open = excluded.is_open, auto_schedule_enabled = excluded.auto_schedule_enabled,
  auto_open_time = excluded.auto_open_time, auto_close_time = excluded.auto_close_time, store_latitude = excluded.store_latitude,
  store_longitude = excluded.store_longitude, delivery_base_fee = excluded.delivery_base_fee,
  delivery_price_per_km = excluded.delivery_price_per_km, delivery_max_distance_km = excluded.delivery_max_distance_km,
  delivery_rounding_value = excluded.delivery_rounding_value;

insert into public.payment_methods (id,name,code,active,display_order) values (md5('payment:pay-efectivo')::uuid,'Efectivo','efectivo'::public.payment_method_code,true,0) on conflict (code) do update set name=excluded.name,active=excluded.active,display_order=excluded.display_order;
insert into public.payment_methods (id,name,code,active,display_order) values (md5('payment:pay-transferencia')::uuid,'Transferencia','transferencia'::public.payment_method_code,true,1) on conflict (code) do update set name=excluded.name,active=excluded.active,display_order=excluded.display_order;

insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-promos')::uuid,'Promos','promos','Combos y opciones para compartir.','BadgePercent',null,1,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-hamburguesas')::uuid,'Hamburguesas clásicas','hamburguesas-clasicas','Las clásicas con pan, carne y extras.','Beef',null,2,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-gourmet')::uuid,'Burgers gourmet','burgers-gourmet','Pan de papa, cheddar y combinaciones potentes.','Beef',null,3,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-lomitos')::uuid,'Lomitos','lomitos','Lomitos completos con papas fritas.','Sandwich',null,4,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-figazzas')::uuid,'Figazza de lomo','figazza-de-lomo','Figazzas cargadas con lomo y papas.','Sandwich',null,5,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-sandwiches')::uuid,'Sándwichs de mila','sandwichs-de-mila','Sándwichs de milanesa con papas.','Sandwich',null,6,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-pizzas')::uuid,'Pizzas','pizzas','Pizzas clásicas de la casa.','Pizza',null,7,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-milanesas')::uuid,'Milanesas','milanesas','Individuales y XXL para compartir.','Utensils',null,8,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-snacks')::uuid,'Papas y extras','papas-extras','Papas, gratinadas, cheddar y acompañamientos.','CookingPot',null,9,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;
insert into public.categories (id,name,slug,description,icon_name,image_url,display_order,active,deleted_at) values (md5('category:cat-bebidas')::uuid,'Bebidas','bebidas','Bebidas frías para acompañar.','CupSoda',null,10,true,null) on conflict (id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,icon_name=excluded.icon_name,display_order=excluded.display_order,active=excluded.active,deleted_at=null;

insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-carne')::uuid,'Carne vacuna','proteina'::public.ingredient_type,'kg'::public.ingredient_unit,'Proveedor Norte',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-pollo')::uuid,'Pollo','proteina'::public.ingredient_type,'kg'::public.ingredient_unit,'Granja Sol',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-pan-burger')::uuid,'Pan de hamburguesa','panificados'::public.ingredient_type,'unidad'::public.ingredient_unit,'Panadería Centro',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-pan-lomo')::uuid,'Pan de lomo','panificados'::public.ingredient_type,'unidad'::public.ingredient_unit,'Panadería Centro',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-queso')::uuid,'Queso barra','lacteos'::public.ingredient_type,'kg'::public.ingredient_unit,'Lácteos Sur',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-cheddar')::uuid,'Cheddar','lacteos'::public.ingredient_type,'kg'::public.ingredient_unit,'Lácteos Sur',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-jamon')::uuid,'Jamón','proteina'::public.ingredient_type,'kg'::public.ingredient_unit,'Fiambres Rocío',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-muzzarella')::uuid,'Muzzarella','lacteos'::public.ingredient_type,'kg'::public.ingredient_unit,'Lácteos Sur',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-tomate')::uuid,'Tomate','verduras'::public.ingredient_type,'kg'::public.ingredient_unit,'Verdulería Feria',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-lechuga')::uuid,'Lechuga','verduras'::public.ingredient_type,'kg'::public.ingredient_unit,'Verdulería Feria',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-huevo')::uuid,'Huevo','otros'::public.ingredient_type,'unidad'::public.ingredient_unit,'Granja Sol',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-papas')::uuid,'Papas','verduras'::public.ingredient_type,'kg'::public.ingredient_unit,'Verdulería Feria',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-harina')::uuid,'Harina','panificados'::public.ingredient_type,'kg'::public.ingredient_unit,'Distribuidora Litoral',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-gaseosa')::uuid,'Gaseosa','bebidas'::public.ingredient_type,'unidad'::public.ingredient_unit,'Distribuidora Litoral',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-packaging')::uuid,'Packaging','insumos'::public.ingredient_type,'unidad'::public.ingredient_unit,'Insumos Ya',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-panceta')::uuid,'Panceta','proteina'::public.ingredient_type,'kg'::public.ingredient_unit,'Fiambres Rocío',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-milanesa')::uuid,'Milanesa','proteina'::public.ingredient_type,'unidad'::public.ingredient_unit,'Proveedor Norte',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-pan-frances')::uuid,'Pan francés','panificados'::public.ingredient_type,'unidad'::public.ingredient_unit,'Panadería Centro',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-pan-figazza')::uuid,'Pan de figazza','panificados'::public.ingredient_type,'unidad'::public.ingredient_unit,'Panadería Centro',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-pan-papa')::uuid,'Pan de papa','panificados'::public.ingredient_type,'unidad'::public.ingredient_unit,'Panadería Centro',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-queso-cremoso')::uuid,'Queso cremoso','lacteos'::public.ingredient_type,'kg'::public.ingredient_unit,'Lácteos Sur',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-cebolla')::uuid,'Cebolla','verduras'::public.ingredient_type,'kg'::public.ingredient_unit,'Verdulería Feria',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-morrones')::uuid,'Morrones','verduras'::public.ingredient_type,'kg'::public.ingredient_unit,'Verdulería Feria',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-mayonesa')::uuid,'Mayonesa','insumos'::public.ingredient_type,'litro'::public.ingredient_unit,'Distribuidora Litoral',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-ketchup')::uuid,'Ketchup','insumos'::public.ingredient_type,'litro'::public.ingredient_unit,'Distribuidora Litoral',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-barbacoa')::uuid,'Salsa barbacoa','insumos'::public.ingredient_type,'litro'::public.ingredient_unit,'Distribuidora Litoral',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-salsa-tomate')::uuid,'Salsa de tomate','insumos'::public.ingredient_type,'litro'::public.ingredient_unit,'Distribuidora Litoral',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;
insert into public.ingredients (id,name,type,unit,supplier,active,last_updated_at,deleted_at) values (md5('ingredient:ing-salame')::uuid,'Salame','proteina'::public.ingredient_type,'kg'::public.ingredient_unit,'Fiambres Rocío',true,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set name=excluded.name,type=excluded.type,unit=excluded.unit,supplier=excluded.supplier,active=excluded.active,last_updated_at=excluded.last_updated_at,deleted_at=null;

insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-promo-central')::uuid,md5('category:cat-promos')::uuid,'Promo La Central','promo-central','Hamburguesa La Central con papas fritas y bebida fría.','/images/productos/combo-central.svg',14500,true,true,true,true,0,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-promo-pizza')::uuid,md5('category:cat-promos')::uuid,'Promo Pizza + bebida','promo-pizza','Pizza muzzarella grande con bebida de 1.5L.','/images/productos/pizza-muzza.svg',12500,true,true,true,true,1,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-promo-mila')::uuid,md5('category:cat-promos')::uuid,'Promo mila para dos','promo-mila','Sándwich de milanesa especial con papas para compartir.','/images/productos/mila-napolitana.svg',15500,true,true,true,true,2,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-hamb-clasica')::uuid,md5('category:cat-hamburguesas')::uuid,'Hamburguesa Clásica','hamb-clasica','Pan, blend de carne, queso, lechuga, tomate y mayonesa.','/images/productos/burger-simple.svg',4500,true,true,false,false,3,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-hamb-especial')::uuid,md5('category:cat-hamburguesas')::uuid,'Hamburguesa Especial','hamb-especial','Pan, blend de carne, queso, jamón, huevo, lechuga, tomate y mayonesa.','/images/productos/burger-completa.svg',5500,true,true,true,false,4,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-hamb-super')::uuid,md5('category:cat-hamburguesas')::uuid,'Hamburguesa Súper','hamb-super','Pan, blend de carne, queso, jamón, huevo, cheddar, panceta, lechuga, tomate y mayonesa.','/images/productos/doble-cheddar.svg',6500,true,true,true,false,5,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-hamb-doble')::uuid,md5('category:cat-hamburguesas')::uuid,'La Doble','hamb-doble','Doble carne, queso x2, jamón x2, huevo x2, cheddar x2, panceta y papas fritas.','/images/productos/doble-cheddar.svg',10500,true,true,true,false,6,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-hamb-central')::uuid,md5('category:cat-hamburguesas')::uuid,'Hamburguesa La Central','hamb-central','Doble carne, queso x2, jamón x2, huevo x2, cheddar x4, panceta x2 y papas.','/images/productos/combo-central.svg',10500,true,true,true,false,7,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-bajonera-simple')::uuid,md5('category:cat-gourmet')::uuid,'Bajonera Simple','gourmet-bajonera-simple','Pan de papa, blend de carne y queso cheddar.','/images/productos/doble-cheddar.svg',8000,true,true,false,false,8,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-bajonera-doble')::uuid,md5('category:cat-gourmet')::uuid,'Bajonera Doble','gourmet-bajonera-doble','Pan de papa, blend de carne y queso cheddar.','/images/productos/doble-cheddar.svg',9500,true,true,false,false,9,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-bajonera-triple')::uuid,md5('category:cat-gourmet')::uuid,'Bajonera Triple','gourmet-bajonera-triple','Pan de papa, blend de carne y queso cheddar.','/images/productos/doble-cheddar.svg',12000,true,true,false,false,10,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-onion-simple')::uuid,md5('category:cat-gourmet')::uuid,'Onion Simple','gourmet-onion-simple','Pan de papa, blend de carne, cheddar, cebolla y ketchup.','/images/productos/doble-cheddar.svg',8000,true,true,false,false,11,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-onion-doble')::uuid,md5('category:cat-gourmet')::uuid,'Onion Doble','gourmet-onion-doble','Pan de papa, blend de carne, cheddar, cebolla y ketchup.','/images/productos/doble-cheddar.svg',9500,true,true,false,false,12,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-onion-triple')::uuid,md5('category:cat-gourmet')::uuid,'Onion Triple','gourmet-onion-triple','Pan de papa, blend de carne, cheddar, cebolla y ketchup.','/images/productos/doble-cheddar.svg',12000,true,true,false,false,13,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-cheddar-simple')::uuid,md5('category:cat-gourmet')::uuid,'Cheddar Simple','gourmet-cheddar-simple','Pan de papa, blend de carne, queso cheddar, panceta y tomate.','/images/productos/doble-cheddar.svg',8000,true,true,false,false,14,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-cheddar-doble')::uuid,md5('category:cat-gourmet')::uuid,'Cheddar Doble','gourmet-cheddar-doble','Pan de papa, blend de carne, queso cheddar, panceta y tomate.','/images/productos/doble-cheddar.svg',9500,true,true,false,false,15,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-cheddar-triple')::uuid,md5('category:cat-gourmet')::uuid,'Cheddar Triple','gourmet-cheddar-triple','Pan de papa, blend de carne, queso cheddar, panceta y tomate.','/images/productos/doble-cheddar.svg',13000,true,true,false,false,16,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-crispy-simple')::uuid,md5('category:cat-gourmet')::uuid,'Crispy Simple','gourmet-crispy-simple','Pan de papa, blend de carne, cheddar, panceta, cebolla crispy y barbacoa.','/images/productos/doble-cheddar.svg',8000,true,true,false,false,17,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-crispy-doble')::uuid,md5('category:cat-gourmet')::uuid,'Crispy Doble','gourmet-crispy-doble','Pan de papa, blend de carne, cheddar, panceta, cebolla crispy y barbacoa.','/images/productos/doble-cheddar.svg',10000,true,true,true,false,18,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-crispy-triple')::uuid,md5('category:cat-gourmet')::uuid,'Crispy Triple','gourmet-crispy-triple','Pan de papa, blend de carne, cheddar, panceta, cebolla crispy y barbacoa.','/images/productos/doble-cheddar.svg',13000,true,true,true,false,19,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-argentina-simple')::uuid,md5('category:cat-gourmet')::uuid,'Argentina Simple','gourmet-argentina-simple','Pan de papa, blend de carne, queso cremoso, jamón, huevo, tomate y lechuga.','/images/productos/doble-cheddar.svg',8000,true,true,false,false,20,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-argentina-doble')::uuid,md5('category:cat-gourmet')::uuid,'Argentina Doble','gourmet-argentina-doble','Pan de papa, blend de carne, queso cremoso, jamón, huevo, tomate y lechuga.','/images/productos/doble-cheddar.svg',9500,true,true,false,false,21,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-argentina-triple')::uuid,md5('category:cat-gourmet')::uuid,'Argentina Triple','gourmet-argentina-triple','Pan de papa, blend de carne, queso cremoso, jamón, huevo, tomate y lechuga.','/images/productos/doble-cheddar.svg',12000,true,true,false,false,22,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-americana-simple')::uuid,md5('category:cat-gourmet')::uuid,'Americana Simple','gourmet-americana-simple','Pan de papa, blend de carne, queso cremoso, panceta, huevo, lechuga y tomate.','/images/productos/doble-cheddar.svg',8000,true,true,false,false,23,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-americana-doble')::uuid,md5('category:cat-gourmet')::uuid,'Americana Doble','gourmet-americana-doble','Pan de papa, blend de carne, queso cremoso, panceta, huevo, lechuga y tomate.','/images/productos/doble-cheddar.svg',9500,true,true,false,false,24,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-americana-triple')::uuid,md5('category:cat-gourmet')::uuid,'Americana Triple','gourmet-americana-triple','Pan de papa, blend de carne, queso cremoso, panceta, huevo, lechuga y tomate.','/images/productos/doble-cheddar.svg',12000,true,true,false,false,25,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-chicago-simple')::uuid,md5('category:cat-gourmet')::uuid,'Chicago Simple','gourmet-chicago-simple','Pan de papa, blend de carne, cheddar, queso cremoso, panceta, jamón, huevo, lechuga, tomate y cebolla morada.','/images/productos/doble-cheddar.svg',8500,true,true,false,false,26,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-chicago-doble')::uuid,md5('category:cat-gourmet')::uuid,'Chicago Doble','gourmet-chicago-doble','Pan de papa, blend de carne, cheddar, queso cremoso, panceta, jamón, huevo, lechuga, tomate y cebolla morada.','/images/productos/doble-cheddar.svg',10000,true,true,true,false,27,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gourmet-chicago-triple')::uuid,md5('category:cat-gourmet')::uuid,'Chicago Triple','gourmet-chicago-triple','Pan de papa, blend de carne, cheddar, queso cremoso, panceta, jamón, huevo, lechuga, tomate y cebolla morada.','/images/productos/doble-cheddar.svg',13500,true,true,true,false,28,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-lomito-clasico')::uuid,md5('category:cat-lomitos')::uuid,'Lomito Clásico','lomito-clasico','Pan francés, lomito, queso, lechuga, tomate y mayonesa. Incluye papas fritas.','/images/productos/lomito-completo.svg',10000,true,true,false,false,29,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-lomito-especial')::uuid,md5('category:cat-lomitos')::uuid,'Lomito Especial','lomito-especial','Pan francés, lomito, queso, jamón, huevo, lechuga, tomate y mayonesa. Incluye papas fritas.','/images/productos/lomito-completo.svg',12000,true,true,true,false,30,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-lomito-central')::uuid,md5('category:cat-lomitos')::uuid,'Lomito La Central','lomito-central','Pan francés, lomito, queso, jamón, huevo, cheddar, panceta, lechuga, tomate y mayonesa.','/images/productos/lomito-completo.svg',14000,true,true,true,false,31,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-lomito-americano')::uuid,md5('category:cat-lomitos')::uuid,'Lomito Americano','lomito-americano','Pan francés, lomito, queso, jamón, huevo, cheddar, panceta, cebolla, BBQ, lechuga, tomate y mayonesa.','/images/productos/lomito-completo.svg',16000,true,true,true,false,32,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-figazza-comun')::uuid,md5('category:cat-figazzas')::uuid,'Figazza Común','figazza-comun','Pan de figazza, lomito, jamón, queso, huevo, tomate y mayonesa. Viene con papas fritas.','/images/productos/lomito-completo.svg',17500,true,true,false,false,33,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-figazza-central')::uuid,md5('category:cat-figazzas')::uuid,'Figazza La Central','figazza-central','Pan de figazza, lomito, jamón, queso, huevo x2, panceta, cheddar, tomate y mayonesa.','/images/productos/combo-central.svg',19500,true,true,true,false,34,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-sand-mila-clasico')::uuid,md5('category:cat-sandwiches')::uuid,'Sándwich de Mila Clásico','sand-mila-clasico','Pan francés, milanesa, queso, lechuga, tomate y mayonesa. Viene con papas fritas.','/images/productos/mila-napolitana.svg',10000,true,true,false,false,35,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-sand-mila-especial')::uuid,md5('category:cat-sandwiches')::uuid,'Sándwich de Mila Especial','sand-mila-especial','Pan francés, milanesa, queso, jamón, huevo, lechuga, tomate y mayonesa. Viene con papas fritas.','/images/productos/mila-napolitana.svg',12000,true,true,false,false,36,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-sand-mila-central')::uuid,md5('category:cat-sandwiches')::uuid,'Sándwich de Mila La Central','sand-mila-central','Pan francés, milanesa, queso, jamón, huevo, cheddar, panceta, lechuga, tomate y mayonesa. Viene con papas fritas.','/images/productos/mila-napolitana.svg',14000,true,true,true,false,37,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-sand-mila-americano')::uuid,md5('category:cat-sandwiches')::uuid,'Sándwich de Mila Americano','sand-mila-americano','Pan francés, milanesa, queso, jamón, huevo, cheddar, panceta, cebolla, BBQ, lechuga, tomate y mayonesa. Viene con papas fritas.','/images/productos/mila-napolitana.svg',16000,true,true,true,false,38,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-pizza-mozzarella')::uuid,md5('category:cat-pizzas')::uuid,'Pizza Mozzarella','pizza-mozzarella','Mozzarella y salsa de tomate.','/images/productos/pizza-muzza.svg',10000,true,true,false,false,39,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-pizza-napolitana')::uuid,md5('category:cat-pizzas')::uuid,'Pizza Napolitana','pizza-napolitana','Mozzarella, tomates en rodajas y salsa de tomate.','/images/productos/pizza-muzza.svg',12000,true,true,false,false,40,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-pizza-correntina')::uuid,md5('category:cat-pizzas')::uuid,'Pizza Correntina','pizza-correntina','Queso cremoso, salsa de tomate y huevo rayado.','/images/productos/pizza-especial.svg',12000,true,true,true,false,41,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-pizza-calabresa')::uuid,md5('category:cat-pizzas')::uuid,'Pizza Calabresa','pizza-calabresa','Mozzarella, salsa de tomate y rodajas de salame.','/images/productos/pizza-especial.svg',14000,true,true,true,false,42,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-pizza-jamon-morrones')::uuid,md5('category:cat-pizzas')::uuid,'Pizza Jamón y Morrones','pizza-jamon-morrones','Mozzarella, salsa de tomate, jamón y morrones.','/images/productos/pizza-especial.svg',14000,true,true,true,false,43,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-pizza-central')::uuid,md5('category:cat-pizzas')::uuid,'Pizza La Central','pizza-central','Mozzarella, salsa de tomate, huevo, jamón y panceta.','/images/productos/pizza-especial.svg',15000,true,true,true,false,44,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-clasica-ind')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Clásica Individual','mila-clasica-ind','Milanesa clásica con guarnición. Come 2 personas.','/images/productos/mila-napolitana.svg',19000,true,true,false,false,45,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-clasica-xxl')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Clásica XXL','mila-clasica-xxl','Milanesa clásica con guarnición. Come hasta 4 personas.','/images/productos/mila-napolitana.svg',25000,true,true,false,false,46,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-a-caballo-ind')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa A Caballo Individual','mila-a-caballo-ind','Milanesa y huevo. Come 2 personas.','/images/productos/mila-napolitana.svg',20000,true,true,false,false,47,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-a-caballo-xxl')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa A Caballo XXL','mila-a-caballo-xxl','Milanesa y huevo. Come hasta 4 personas.','/images/productos/mila-napolitana.svg',26000,true,true,false,false,48,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-napolitana-ind')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Napolitana Individual','mila-napolitana-ind','Milanesa, salsa de tomates, queso, jamón y tomates en rodajas. Come 2 personas.','/images/productos/mila-napolitana.svg',22000,true,true,true,false,49,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-napolitana-xxl')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Napolitana XXL','mila-napolitana-xxl','Milanesa, salsa de tomates, queso, jamón y tomates en rodajas. Come hasta 4 personas.','/images/productos/mila-napolitana.svg',28000,true,true,false,false,50,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-calabresa-ind')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Calabresa Individual','mila-calabresa-ind','Milanesa, salsa de tomates, queso y salame en rodajas. Come 2 personas.','/images/productos/mila-napolitana.svg',22000,true,true,false,false,51,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-calabresa-xxl')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Calabresa XXL','mila-calabresa-xxl','Milanesa, salsa de tomates, queso y salame en rodajas. Come hasta 4 personas.','/images/productos/mila-napolitana.svg',28000,true,true,false,false,52,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-completa-ind')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Completa Individual','mila-completa-ind','Milanesa, salsa de tomates, queso, jamón, huevo y morrones a elección. Come 2 personas.','/images/productos/mila-napolitana.svg',22000,true,true,false,false,53,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-completa-xxl')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa Completa XXL','mila-completa-xxl','Milanesa, salsa de tomates, queso, jamón, huevo y morrones a elección. Come hasta 4 personas.','/images/productos/mila-napolitana.svg',28000,true,true,true,false,54,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-la-central-ind')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa La Central Individual','mila-la-central-ind','Milanesa, BBQ, queso cheddar, panceta, jamón y huevo. Come 2 personas.','/images/productos/mila-napolitana.svg',23000,true,true,true,false,55,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-mila-la-central-xxl')::uuid,md5('category:cat-milanesas')::uuid,'Milanesa La Central XXL','mila-la-central-xxl','Milanesa, BBQ, queso cheddar, panceta, jamón y huevo. Come hasta 4 personas.','/images/productos/mila-napolitana.svg',30000,true,true,true,false,56,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-papas')::uuid,md5('category:cat-snacks')::uuid,'Papas fritas','papas','Porción de papas fritas crocantes.','/images/productos/papas-cheddar.svg',2000,true,true,false,false,57,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-papas-gratinadas')::uuid,md5('category:cat-snacks')::uuid,'Papas gratinadas','papas-gratinadas','Papas con gratinado caliente.','/images/productos/papas-cheddar.svg',4000,true,true,true,false,58,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-papas-cheddar')::uuid,md5('category:cat-snacks')::uuid,'Papas cheddar','papas-cheddar','Papas fritas con cheddar.','/images/productos/papas-cheddar.svg',4000,true,true,true,false,59,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;
insert into public.products (id,category_id,name,slug,description,image_url,current_price,active,available,featured,is_promotion,display_order,created_at,updated_at,deleted_at) values (md5('product:prod-gaseosa')::uuid,md5('category:cat-bebidas')::uuid,'Gaseosa 1.5L','gaseosa','Bebida fría de 1.5 litros para acompañar tu pedido.','/images/productos/gaseosa.svg',2800,true,true,false,false,60,'2026-06-30T10:00:00.000Z'::timestamptz,'2026-06-30T10:00:00.000Z'::timestamptz,null) on conflict (id) do update set category_id=excluded.category_id,name=excluded.name,slug=excluded.slug,description=excluded.description,image_url=excluded.image_url,current_price=excluded.current_price,active=excluded.active,available=excluded.available,featured=excluded.featured,is_promotion=excluded.is_promotion,display_order=excluded.display_order,deleted_at=null;

delete from public.product_ingredients where product_id in (select id from public.products where deleted_at is null);
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-central:ing-pan-burger')::uuid,md5('product:prod-promo-central')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-central:ing-papas')::uuid,md5('product:prod-promo-central')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-central:ing-gaseosa')::uuid,md5('product:prod-promo-central')::uuid,md5('ingredient:ing-gaseosa')::uuid,null,'unidad'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-pizza:ing-muzzarella')::uuid,md5('product:prod-promo-pizza')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-pizza:ing-harina')::uuid,md5('product:prod-promo-pizza')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-pizza:ing-gaseosa')::uuid,md5('product:prod-promo-pizza')::uuid,md5('ingredient:ing-gaseosa')::uuid,null,'unidad'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-mila:ing-milanesa')::uuid,md5('product:prod-promo-mila')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-promo-mila:ing-papas')::uuid,md5('product:prod-promo-mila')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-clasica:ing-carne')::uuid,md5('product:prod-hamb-clasica')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-clasica:ing-pan-burger')::uuid,md5('product:prod-hamb-clasica')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-clasica:ing-queso')::uuid,md5('product:prod-hamb-clasica')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-clasica:ing-tomate')::uuid,md5('product:prod-hamb-clasica')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-clasica:ing-lechuga')::uuid,md5('product:prod-hamb-clasica')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-clasica:ing-mayonesa')::uuid,md5('product:prod-hamb-clasica')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-carne')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-pan-burger')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-queso')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-jamon')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-tomate')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-lechuga')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-huevo')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-especial:ing-mayonesa')::uuid,md5('product:prod-hamb-especial')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-carne')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-pan-burger')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-queso')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-cheddar')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-jamon')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-panceta')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-tomate')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-lechuga')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-huevo')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-super:ing-mayonesa')::uuid,md5('product:prod-hamb-super')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-carne')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-pan-burger')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-queso')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-cheddar')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-jamon')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-panceta')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-huevo')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-doble:ing-papas')::uuid,md5('product:prod-hamb-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-carne')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-pan-burger')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-queso')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-cheddar')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-jamon')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-panceta')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-huevo')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-hamb-central:ing-papas')::uuid,md5('product:prod-hamb-central')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-simple:ing-carne')::uuid,md5('product:prod-gourmet-bajonera-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-bajonera-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-simple:ing-queso')::uuid,md5('product:prod-gourmet-bajonera-simple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-simple:ing-cheddar')::uuid,md5('product:prod-gourmet-bajonera-simple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-simple:ing-papas')::uuid,md5('product:prod-gourmet-bajonera-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-doble:ing-carne')::uuid,md5('product:prod-gourmet-bajonera-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-bajonera-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-doble:ing-queso')::uuid,md5('product:prod-gourmet-bajonera-doble')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-doble:ing-cheddar')::uuid,md5('product:prod-gourmet-bajonera-doble')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-doble:ing-papas')::uuid,md5('product:prod-gourmet-bajonera-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-triple:ing-carne')::uuid,md5('product:prod-gourmet-bajonera-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-bajonera-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-triple:ing-queso')::uuid,md5('product:prod-gourmet-bajonera-triple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-triple:ing-cheddar')::uuid,md5('product:prod-gourmet-bajonera-triple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-bajonera-triple:ing-papas')::uuid,md5('product:prod-gourmet-bajonera-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-simple:ing-carne')::uuid,md5('product:prod-gourmet-onion-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-onion-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-simple:ing-cheddar')::uuid,md5('product:prod-gourmet-onion-simple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-simple:ing-cebolla')::uuid,md5('product:prod-gourmet-onion-simple')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-simple:ing-papas')::uuid,md5('product:prod-gourmet-onion-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-simple:ing-ketchup')::uuid,md5('product:prod-gourmet-onion-simple')::uuid,md5('ingredient:ing-ketchup')::uuid,null,'litro'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-doble:ing-carne')::uuid,md5('product:prod-gourmet-onion-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-onion-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-doble:ing-cheddar')::uuid,md5('product:prod-gourmet-onion-doble')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-doble:ing-cebolla')::uuid,md5('product:prod-gourmet-onion-doble')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-doble:ing-papas')::uuid,md5('product:prod-gourmet-onion-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-doble:ing-ketchup')::uuid,md5('product:prod-gourmet-onion-doble')::uuid,md5('ingredient:ing-ketchup')::uuid,null,'litro'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-triple:ing-carne')::uuid,md5('product:prod-gourmet-onion-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-onion-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-triple:ing-cheddar')::uuid,md5('product:prod-gourmet-onion-triple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-triple:ing-cebolla')::uuid,md5('product:prod-gourmet-onion-triple')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-triple:ing-papas')::uuid,md5('product:prod-gourmet-onion-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-onion-triple:ing-ketchup')::uuid,md5('product:prod-gourmet-onion-triple')::uuid,md5('ingredient:ing-ketchup')::uuid,null,'litro'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-carne')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-queso')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-cheddar')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-panceta')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-tomate')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-simple:ing-papas')::uuid,md5('product:prod-gourmet-cheddar-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-carne')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-queso')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-cheddar')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-panceta')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-tomate')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-doble:ing-papas')::uuid,md5('product:prod-gourmet-cheddar-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-carne')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-queso')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-cheddar')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-panceta')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-tomate')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-cheddar-triple:ing-papas')::uuid,md5('product:prod-gourmet-cheddar-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-carne')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-cheddar')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-panceta')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-cebolla')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-papas')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-simple:ing-barbacoa')::uuid,md5('product:prod-gourmet-crispy-simple')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-carne')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-cheddar')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-panceta')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-cebolla')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-papas')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-doble:ing-barbacoa')::uuid,md5('product:prod-gourmet-crispy-doble')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-carne')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-cheddar')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-panceta')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-cebolla')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-papas')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-crispy-triple:ing-barbacoa')::uuid,md5('product:prod-gourmet-crispy-triple')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-carne')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-queso')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-jamon')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-tomate')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-lechuga')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-huevo')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-simple:ing-papas')::uuid,md5('product:prod-gourmet-argentina-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-carne')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-queso')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-jamon')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-tomate')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-lechuga')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-huevo')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-doble:ing-papas')::uuid,md5('product:prod-gourmet-argentina-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-carne')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-queso')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-jamon')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-tomate')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-lechuga')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-huevo')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-argentina-triple:ing-papas')::uuid,md5('product:prod-gourmet-argentina-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-carne')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-queso')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-panceta')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-tomate')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-lechuga')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-huevo')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-simple:ing-papas')::uuid,md5('product:prod-gourmet-americana-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-carne')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-queso')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-panceta')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-tomate')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-lechuga')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-huevo')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-doble:ing-papas')::uuid,md5('product:prod-gourmet-americana-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-carne')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-queso')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-panceta')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-tomate')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-lechuga')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-huevo')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-americana-triple:ing-papas')::uuid,md5('product:prod-gourmet-americana-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-carne')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-pan-papa')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-queso')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-cheddar')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-jamon')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-panceta')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-tomate')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-lechuga')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-cebolla')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-huevo')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,10) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-simple:ing-papas')::uuid,md5('product:prod-gourmet-chicago-simple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,11) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-carne')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-pan-papa')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-queso')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-cheddar')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-jamon')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-panceta')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-tomate')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-lechuga')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-cebolla')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-huevo')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,10) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-doble:ing-papas')::uuid,md5('product:prod-gourmet-chicago-doble')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,11) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-carne')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-pan-papa')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-pan-papa')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-queso')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-queso-cremoso')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-cheddar')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-jamon')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-panceta')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-tomate')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-lechuga')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-cebolla')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-huevo')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,10) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gourmet-chicago-triple:ing-papas')::uuid,md5('product:prod-gourmet-chicago-triple')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,11) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-carne')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-pan-frances')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-queso')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-tomate')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-lechuga')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-papas')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-clasico:ing-mayonesa')::uuid,md5('product:prod-lomito-clasico')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-carne')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-pan-frances')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-queso')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-jamon')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-tomate')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-lechuga')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-huevo')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-papas')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-especial:ing-mayonesa')::uuid,md5('product:prod-lomito-especial')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-carne')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-pan-frances')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-queso')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-cheddar')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-jamon')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-panceta')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-tomate')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-lechuga')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-huevo')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-central:ing-mayonesa')::uuid,md5('product:prod-lomito-central')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-carne')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-pan-frances')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-queso')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-cheddar')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-jamon')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-panceta')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-tomate')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-lechuga')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-cebolla')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-huevo')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-mayonesa')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,10) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-lomito-americano:ing-barbacoa')::uuid,md5('product:prod-lomito-americano')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,11) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-carne')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-pan-figazza')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-pan-figazza')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-queso')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-jamon')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-tomate')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-huevo')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-papas')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-comun:ing-mayonesa')::uuid,md5('product:prod-figazza-comun')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-carne')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-carne')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-pan-figazza')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-pan-figazza')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-queso')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-cheddar')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-jamon')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-panceta')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-tomate')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-huevo')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-figazza-central:ing-mayonesa')::uuid,md5('product:prod-figazza-central')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-milanesa')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-pan-frances')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-queso')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-tomate')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-lechuga')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-papas')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-clasico:ing-mayonesa')::uuid,md5('product:prod-sand-mila-clasico')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-milanesa')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-pan-frances')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-queso')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-jamon')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-tomate')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-lechuga')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-huevo')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-papas')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-especial:ing-mayonesa')::uuid,md5('product:prod-sand-mila-especial')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-milanesa')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-pan-frances')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-queso')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-cheddar')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-jamon')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-panceta')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-tomate')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-lechuga')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-huevo')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-papas')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-central:ing-mayonesa')::uuid,md5('product:prod-sand-mila-central')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,10) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-milanesa')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-pan-frances')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-pan-frances')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-queso')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-cheddar')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-jamon')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-panceta')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-tomate')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-lechuga')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-lechuga')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-cebolla')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-cebolla')::uuid,null,'kg'::public.ingredient_unit,8) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-huevo')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,9) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-papas')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,10) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-mayonesa')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-mayonesa')::uuid,null,'litro'::public.ingredient_unit,11) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-sand-mila-americano:ing-barbacoa')::uuid,md5('product:prod-sand-mila-americano')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,12) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-mozzarella:ing-muzzarella')::uuid,md5('product:prod-pizza-mozzarella')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-mozzarella:ing-tomate')::uuid,md5('product:prod-pizza-mozzarella')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-mozzarella:ing-salsa-tomate')::uuid,md5('product:prod-pizza-mozzarella')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-mozzarella:ing-harina')::uuid,md5('product:prod-pizza-mozzarella')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-napolitana:ing-muzzarella')::uuid,md5('product:prod-pizza-napolitana')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-napolitana:ing-tomate')::uuid,md5('product:prod-pizza-napolitana')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-napolitana:ing-salsa-tomate')::uuid,md5('product:prod-pizza-napolitana')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-napolitana:ing-harina')::uuid,md5('product:prod-pizza-napolitana')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-queso')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-queso-cremoso')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-queso-cremoso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-muzzarella')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-tomate')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-huevo')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-salsa-tomate')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-correntina:ing-harina')::uuid,md5('product:prod-pizza-correntina')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-calabresa:ing-muzzarella')::uuid,md5('product:prod-pizza-calabresa')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-calabresa:ing-salame')::uuid,md5('product:prod-pizza-calabresa')::uuid,md5('ingredient:ing-salame')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-calabresa:ing-tomate')::uuid,md5('product:prod-pizza-calabresa')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-calabresa:ing-salsa-tomate')::uuid,md5('product:prod-pizza-calabresa')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-calabresa:ing-harina')::uuid,md5('product:prod-pizza-calabresa')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-jamon-morrones:ing-jamon')::uuid,md5('product:prod-pizza-jamon-morrones')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-jamon-morrones:ing-muzzarella')::uuid,md5('product:prod-pizza-jamon-morrones')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-jamon-morrones:ing-tomate')::uuid,md5('product:prod-pizza-jamon-morrones')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-jamon-morrones:ing-morrones')::uuid,md5('product:prod-pizza-jamon-morrones')::uuid,md5('ingredient:ing-morrones')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-jamon-morrones:ing-salsa-tomate')::uuid,md5('product:prod-pizza-jamon-morrones')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-jamon-morrones:ing-harina')::uuid,md5('product:prod-pizza-jamon-morrones')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-pan-burger')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-jamon')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-muzzarella')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-muzzarella')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-panceta')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-tomate')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-huevo')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-salsa-tomate')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-pizza-central:ing-harina')::uuid,md5('product:prod-pizza-central')::uuid,md5('ingredient:ing-harina')::uuid,null,'kg'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-clasica-ind:ing-milanesa')::uuid,md5('product:prod-mila-clasica-ind')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-clasica-xxl:ing-milanesa')::uuid,md5('product:prod-mila-clasica-xxl')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-a-caballo-ind:ing-milanesa')::uuid,md5('product:prod-mila-a-caballo-ind')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-a-caballo-ind:ing-huevo')::uuid,md5('product:prod-mila-a-caballo-ind')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-a-caballo-xxl:ing-milanesa')::uuid,md5('product:prod-mila-a-caballo-xxl')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-a-caballo-xxl:ing-huevo')::uuid,md5('product:prod-mila-a-caballo-xxl')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-ind:ing-milanesa')::uuid,md5('product:prod-mila-napolitana-ind')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-ind:ing-queso')::uuid,md5('product:prod-mila-napolitana-ind')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-ind:ing-jamon')::uuid,md5('product:prod-mila-napolitana-ind')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-ind:ing-tomate')::uuid,md5('product:prod-mila-napolitana-ind')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-ind:ing-salsa-tomate')::uuid,md5('product:prod-mila-napolitana-ind')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-xxl:ing-milanesa')::uuid,md5('product:prod-mila-napolitana-xxl')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-xxl:ing-queso')::uuid,md5('product:prod-mila-napolitana-xxl')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-xxl:ing-jamon')::uuid,md5('product:prod-mila-napolitana-xxl')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-xxl:ing-tomate')::uuid,md5('product:prod-mila-napolitana-xxl')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-napolitana-xxl:ing-salsa-tomate')::uuid,md5('product:prod-mila-napolitana-xxl')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-ind:ing-milanesa')::uuid,md5('product:prod-mila-calabresa-ind')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-ind:ing-queso')::uuid,md5('product:prod-mila-calabresa-ind')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-ind:ing-salame')::uuid,md5('product:prod-mila-calabresa-ind')::uuid,md5('ingredient:ing-salame')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-ind:ing-tomate')::uuid,md5('product:prod-mila-calabresa-ind')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-ind:ing-salsa-tomate')::uuid,md5('product:prod-mila-calabresa-ind')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-xxl:ing-milanesa')::uuid,md5('product:prod-mila-calabresa-xxl')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-xxl:ing-queso')::uuid,md5('product:prod-mila-calabresa-xxl')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-xxl:ing-salame')::uuid,md5('product:prod-mila-calabresa-xxl')::uuid,md5('ingredient:ing-salame')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-xxl:ing-tomate')::uuid,md5('product:prod-mila-calabresa-xxl')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-calabresa-xxl:ing-salsa-tomate')::uuid,md5('product:prod-mila-calabresa-xxl')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-milanesa')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-queso')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-jamon')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-tomate')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-morrones')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-morrones')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-huevo')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-ind:ing-salsa-tomate')::uuid,md5('product:prod-mila-completa-ind')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-milanesa')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-queso')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-jamon')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-tomate')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-tomate')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-morrones')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-morrones')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-huevo')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-completa-xxl:ing-salsa-tomate')::uuid,md5('product:prod-mila-completa-xxl')::uuid,md5('ingredient:ing-salsa-tomate')::uuid,null,'litro'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-milanesa')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-pan-burger')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-queso')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-cheddar')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-jamon')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-panceta')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-huevo')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-ind:ing-barbacoa')::uuid,md5('product:prod-mila-la-central-ind')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-milanesa')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-milanesa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-pan-burger')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-pan-burger')::uuid,null,'unidad'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-queso')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-queso')::uuid,null,'kg'::public.ingredient_unit,2) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-cheddar')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-cheddar')::uuid,null,'kg'::public.ingredient_unit,3) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-jamon')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-jamon')::uuid,null,'kg'::public.ingredient_unit,4) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-panceta')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-panceta')::uuid,null,'kg'::public.ingredient_unit,5) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-huevo')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-huevo')::uuid,null,'unidad'::public.ingredient_unit,6) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-mila-la-central-xxl:ing-barbacoa')::uuid,md5('product:prod-mila-la-central-xxl')::uuid,md5('ingredient:ing-barbacoa')::uuid,null,'litro'::public.ingredient_unit,7) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-papas:ing-papas')::uuid,md5('product:prod-papas')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-papas-gratinadas:ing-papas')::uuid,md5('product:prod-papas-gratinadas')::uuid,md5('ingredient:ing-papas')::uuid,null,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-papas-cheddar:ing-papas')::uuid,md5('product:prod-papas-cheddar')::uuid,md5('ingredient:ing-papas')::uuid,0.55,'kg'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-papas-cheddar:ing-cheddar')::uuid,md5('product:prod-papas-cheddar')::uuid,md5('ingredient:ing-cheddar')::uuid,0.09,'kg'::public.ingredient_unit,1) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;
insert into public.product_ingredients (id,product_id,ingredient_id,quantity,unit,display_order) values (md5('product-ingredient:prod-gaseosa:ing-gaseosa')::uuid,md5('product:prod-gaseosa')::uuid,md5('ingredient:ing-gaseosa')::uuid,null,'unidad'::public.ingredient_unit,0) on conflict (product_id,ingredient_id) do update set quantity=excluded.quantity,unit=excluded.unit,display_order=excluded.display_order;

commit;

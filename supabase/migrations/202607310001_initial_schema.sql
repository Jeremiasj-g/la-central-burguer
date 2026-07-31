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

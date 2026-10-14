-- Cache reutilizable para rutas de delivery.
-- Reduce consultas a SerpApi reutilizando rutas recientes cercanas durante 7 días.

create table if not exists public.delivery_route_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  provider text not null,
  travel_mode text not null,
  store_latitude numeric(10,7) not null,
  store_longitude numeric(10,7) not null,
  customer_latitude numeric(10,7) not null,
  customer_longitude numeric(10,7) not null,
  route_distance_km numeric(8,3) not null
    check (route_distance_km >= 0),
  route_duration_seconds integer
    check (route_duration_seconds is null or route_duration_seconds >= 0),
  route_via text,
  formatted_duration text,
  expires_at timestamptz not null,
  hit_count integer not null default 0
    check (hit_count >= 0),
  last_used_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists delivery_route_cache_lookup_idx
  on public.delivery_route_cache (provider, travel_mode, expires_at desc);

create index if not exists delivery_route_cache_customer_coords_idx
  on public.delivery_route_cache (customer_latitude, customer_longitude);

alter table public.delivery_route_cache enable row level security;

revoke all on table public.delivery_route_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.delivery_route_cache to service_role;

comment on table public.delivery_route_cache is
  'Cache server-side de rutas reales para reducir consultas a SerpApi.';

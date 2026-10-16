-- Suscripciones Push de Admin, aisladas de Delivery.
-- Agregadas al proyecto de producción mediante migración 20261016111429.
create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);
create index if not exists admin_push_subscriptions_user_id_idx
  on public.admin_push_subscriptions(user_id);
alter table public.admin_push_subscriptions enable row level security;
revoke all on public.admin_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.admin_push_subscriptions to service_role;

create table if not exists public.admin_push_dispatches (
  order_id uuid primary key references public.orders(id) on delete cascade,
  dispatched_at timestamptz not null default timezone('utc', now())
);
alter table public.admin_push_dispatches enable row level security;
revoke all on public.admin_push_dispatches from public, anon, authenticated;
grant select, insert, delete on public.admin_push_dispatches to service_role;

comment on table public.admin_push_subscriptions is 'Dispositivos Admin con Web Push; no se comparte con Delivery.';
comment on table public.admin_push_dispatches is 'Deduplicación de avisos Push por pedido confirmado.';

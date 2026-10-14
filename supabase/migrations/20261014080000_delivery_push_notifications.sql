-- Suscripciones Web Push para el panel de repartidores.
-- Las claves VAPID se insertan fuera del repositorio y quedan accesibles solo con service_role.

create table if not exists public.delivery_push_subscriptions (
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

create index if not exists delivery_push_subscriptions_user_idx
  on public.delivery_push_subscriptions (user_id);

alter table public.delivery_push_subscriptions enable row level security;
revoke all on table public.delivery_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.delivery_push_subscriptions to service_role;

create table if not exists public.app_push_config (
  id smallint primary key check (id = 1),
  vapid_public_key text not null,
  vapid_private_key text not null,
  subject text not null default 'mailto:admin@lacentralburger.app',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_push_config enable row level security;
revoke all on table public.app_push_config from public, anon, authenticated;
grant select, insert, update, delete on table public.app_push_config to service_role;

comment on table public.delivery_push_subscriptions is
  'Dispositivos autorizados para recibir Web Push de repartidores.';
comment on table public.app_push_config is
  'Configuración privada VAPID para Web Push; solo service_role.';

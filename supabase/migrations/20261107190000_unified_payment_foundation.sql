-- Unified payments foundation. Additive only: existing orders and reports remain unchanged
-- until the full checkout, counter, dispatch and reporting rollout is verified.
-- Historic orders are intentionally NOT backfilled as confirmed payments.

alter table public.orders
  add column if not exists payment_preference text;

alter table public.orders
  add constraint orders_payment_preference_check
  check (payment_preference is null or payment_preference in ('efectivo', 'transferencia', 'combinado'));

create table public.order_payment_plans (
  order_id uuid primary key references public.orders(id) on delete restrict,
  transfer_amount numeric(12,2) not null default 0 check (transfer_amount >= 0),
  cash_amount numeric(12,2) not null default 0 check (cash_amount >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.order_payment_movements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  method public.payment_method_code not null,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null default 'payment' check (kind in ('payment','reversal','refund')),
  source text not null check (source in ('admin','counter','delivery')),
  delivery_assignment_id uuid references public.delivery_assignments(id) on delete restrict,
  related_movement_id uuid references public.order_payment_movements(id) on delete restrict,
  idempotency_key uuid not null unique,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  reason text,
  created_at timestamptz not null default now(),
  constraint payment_movement_relation_check check (
    (kind = 'payment' and related_movement_id is null)
    or (kind in ('reversal','refund') and related_movement_id is not null and length(trim(coalesce(reason,''))) > 0)
  ),
  constraint payment_movement_delivery_check check (
    source <> 'delivery' or (method = 'efectivo' and delivery_assignment_id is not null)
  )
);
create index order_payment_movements_order_date_idx on public.order_payment_movements(order_id, confirmed_at desc);
create index order_payment_movements_method_date_idx on public.order_payment_movements(method, confirmed_at desc);
create unique index order_payment_movements_one_reversal_idx on public.order_payment_movements(related_movement_id)
  where kind = 'reversal';

alter table public.order_payment_plans enable row level security;
alter table public.order_payment_movements enable row level security;

-- Financial mutations must go through audited, transactional server-side operations.
revoke all on public.order_payment_plans, public.order_payment_movements from public, anon, authenticated;
grant select on public.order_payment_plans, public.order_payment_movements to authenticated;

create policy "Admins read payment plans" on public.order_payment_plans
  for select to authenticated using (private.is_admin());
create policy "Admins read payment movements" on public.order_payment_movements
  for select to authenticated using (private.is_admin());

comment on table public.order_payment_movements is
  'Immutable confirmed cash movements. Do not infer historic confirmed payments from orders.payment_method.';
comment on column public.orders.payment_preference is
  'Customer preference, not proof of payment. Null means legacy order.';

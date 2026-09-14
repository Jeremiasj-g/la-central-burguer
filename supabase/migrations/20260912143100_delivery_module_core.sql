create type public.delivery_vehicle_type as enum ('moto', 'auto', 'bici', 'otro');
create type public.delivery_assignment_status as enum ('assigned', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled');
create type public.delivery_settlement_status as enum ('draft', 'paid', 'cancelled');

create table public.delivery_drivers (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  vehicle_type public.delivery_vehicle_type not null default 'moto',
  active boolean not null default true,
  started_at date not null default current_date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger delivery_drivers_set_updated_at before update on public.delivery_drivers
for each row execute function public.set_updated_at();
create index delivery_drivers_active_idx on public.delivery_drivers(active);

create table public.delivery_driver_rates (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.delivery_drivers(profile_id) on delete cascade,
  commission_percent numeric(5,2) not null check (commission_percent >= 0 and commission_percent <= 100),
  valid_from timestamptz not null default timezone('utc', now()),
  valid_to timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (valid_to is null or valid_to > valid_from)
);
create unique index delivery_driver_rates_current_uidx on public.delivery_driver_rates(driver_id) where valid_to is null;
create index delivery_driver_rates_driver_period_idx on public.delivery_driver_rates(driver_id, valid_from desc);

create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  driver_id uuid not null references public.delivery_drivers(profile_id) on delete restrict,
  status public.delivery_assignment_status not null default 'assigned',
  delivery_fee_snapshot numeric(12,2) not null check (delivery_fee_snapshot >= 0),
  commission_percent_snapshot numeric(5,2) not null check (commission_percent_snapshot >= 0 and commission_percent_snapshot <= 100),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  cash_to_collect numeric(12,2) not null default 0 check (cash_to_collect >= 0),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create trigger delivery_assignments_set_updated_at before update on public.delivery_assignments
for each row execute function public.set_updated_at();
create unique index delivery_assignments_one_live_per_order_uidx on public.delivery_assignments(order_id) where status <> 'cancelled';
create index delivery_assignments_driver_status_idx on public.delivery_assignments(driver_id, status, assigned_at desc);
create index delivery_assignments_order_idx on public.delivery_assignments(order_id, assigned_at desc);
create index delivery_assignments_delivered_idx on public.delivery_assignments(driver_id, delivered_at desc) where status = 'delivered';

create table public.delivery_assignment_events (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references public.delivery_assignments(id) on delete cascade,
  status public.delivery_assignment_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);
create index delivery_assignment_events_assignment_idx on public.delivery_assignment_events(assignment_id, created_at);

create table public.delivery_settlements (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.delivery_drivers(profile_id) on delete restrict,
  period_from timestamptz not null,
  period_to timestamptz not null,
  status public.delivery_settlement_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  paid_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (period_to > period_from)
);
create trigger delivery_settlements_set_updated_at before update on public.delivery_settlements
for each row execute function public.set_updated_at();
create index delivery_settlements_driver_status_idx on public.delivery_settlements(driver_id, status, created_at desc);

create table public.delivery_settlement_items (
  settlement_id uuid not null references public.delivery_settlements(id) on delete cascade,
  assignment_id uuid not null unique references public.delivery_assignments(id) on delete restrict,
  commission_amount_snapshot numeric(12,2) not null check (commission_amount_snapshot >= 0),
  cash_collected_snapshot numeric(12,2) not null check (cash_collected_snapshot >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (settlement_id, assignment_id)
);
create index delivery_settlement_items_settlement_idx on public.delivery_settlement_items(settlement_id);

create or replace function private.current_delivery_driver_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select d.profile_id
  from public.delivery_drivers d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid() and d.active = true and p.active = true and p.role::text = 'delivery'
  limit 1;
$$;
revoke all on function private.current_delivery_driver_id() from public;
grant execute on function private.current_delivery_driver_id() to authenticated;

create or replace function private.is_delivery_driver()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select private.current_delivery_driver_id() is not null;
$$;
revoke all on function private.is_delivery_driver() from public;
grant execute on function private.is_delivery_driver() to authenticated;

alter table public.delivery_drivers enable row level security;
alter table public.delivery_driver_rates enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_assignment_events enable row level security;
alter table public.delivery_settlements enable row level security;
alter table public.delivery_settlement_items enable row level security;

revoke all on public.delivery_drivers, public.delivery_driver_rates, public.delivery_assignments,
  public.delivery_assignment_events, public.delivery_settlements, public.delivery_settlement_items
from anon, authenticated;
grant select on public.delivery_drivers, public.delivery_driver_rates, public.delivery_assignments,
  public.delivery_assignment_events, public.delivery_settlements, public.delivery_settlement_items
to authenticated;

create policy delivery_drivers_admin_or_self_select on public.delivery_drivers for select to authenticated
using ((select private.is_admin()) or profile_id = (select private.current_delivery_driver_id()));
create policy delivery_driver_rates_admin_or_self_select on public.delivery_driver_rates for select to authenticated
using ((select private.is_admin()) or driver_id = (select private.current_delivery_driver_id()));
create policy delivery_assignments_admin_or_self_select on public.delivery_assignments for select to authenticated
using ((select private.is_admin()) or driver_id = (select private.current_delivery_driver_id()));
create policy delivery_assignment_events_admin_or_self_select on public.delivery_assignment_events for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.delivery_assignments da where da.id = assignment_id and da.driver_id = (select private.current_delivery_driver_id())
));
create policy delivery_settlements_admin_or_self_select on public.delivery_settlements for select to authenticated
using ((select private.is_admin()) or driver_id = (select private.current_delivery_driver_id()));
create policy delivery_settlement_items_admin_or_self_select on public.delivery_settlement_items for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.delivery_settlements ds where ds.id = settlement_id and ds.driver_id = (select private.current_delivery_driver_id())
));

create or replace function public.admin_set_delivery_driver_rate(target_driver_id uuid, new_percent numeric)
returns void language plpgsql security definer set search_path = public, private as $$
declare actor uuid := auth.uid(); stamp timestamptz := timezone('utc', now());
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if new_percent is null or new_percent < 0 or new_percent > 100 then raise exception 'El porcentaje de comisión debe estar entre 0 y 100.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.delivery_drivers d join public.profiles p on p.id = d.profile_id
    where d.profile_id = target_driver_id and p.role::text = 'delivery'
  ) then raise exception 'Repartidor no encontrado.' using errcode = 'P0001'; end if;
  update public.delivery_driver_rates set valid_to = stamp where driver_id = target_driver_id and valid_to is null;
  insert into public.delivery_driver_rates(driver_id, commission_percent, valid_from, created_by)
  values (target_driver_id, round(new_percent::numeric, 2), stamp, actor);
end; $$;
revoke all on function public.admin_set_delivery_driver_rate(uuid, numeric) from public, anon;
grant execute on function public.admin_set_delivery_driver_rate(uuid, numeric) to authenticated;

create or replace function public.admin_assign_delivery(order_uuid uuid, driver_uuid uuid, note text default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  actor uuid := auth.uid();
  target_order public.orders%rowtype;
  rate numeric(5,2);
  current_assignment public.delivery_assignments%rowtype;
  new_assignment_id uuid;
  cash_amount numeric(12,2);
  commission numeric(12,2);
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into target_order from public.orders where id = order_uuid for update;
  if not found then raise exception 'Pedido no encontrado.' using errcode = 'P0001'; end if;
  if target_order.delivery_method <> 'delivery' then raise exception 'El pedido no es delivery.' using errcode = '22023'; end if;
  if target_order.status in ('cancelado', 'entregado') then raise exception 'El pedido ya no admite asignación.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.delivery_drivers d join public.profiles p on p.id = d.profile_id
    where d.profile_id = driver_uuid and d.active = true and p.active = true and p.role::text = 'delivery'
  ) then raise exception 'El repartidor no está disponible.' using errcode = 'P0001'; end if;
  select commission_percent into rate from public.delivery_driver_rates
  where driver_id = driver_uuid and valid_from <= timezone('utc', now()) and (valid_to is null or valid_to > timezone('utc', now()))
  order by valid_from desc limit 1;
  if rate is null then raise exception 'El repartidor no tiene una comisión vigente.' using errcode = 'P0001'; end if;
  select * into current_assignment from public.delivery_assignments
  where order_id = order_uuid and status <> 'cancelled' order by assigned_at desc limit 1 for update;
  if found and current_assignment.driver_id = driver_uuid then return current_assignment.id; end if;
  if found then
    update public.delivery_assignments set status = 'cancelled', cancelled_at = timezone('utc', now()),
      cancellation_reason = coalesce(nullif(btrim(note), ''), 'Reasignación administrativa') where id = current_assignment.id;
    insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
    values (current_assignment.id, 'cancelled', actor, coalesce(nullif(btrim(note), ''), 'Reasignación administrativa'));
  end if;
  cash_amount := case when target_order.payment_method = 'efectivo' then target_order.total else 0 end;
  commission := round((target_order.delivery_cost * rate / 100.0)::numeric, 2);
  insert into public.delivery_assignments(order_id, driver_id, status, delivery_fee_snapshot, commission_percent_snapshot, commission_amount, cash_to_collect, assigned_by)
  values (order_uuid, driver_uuid, 'assigned', target_order.delivery_cost, rate, commission, cash_amount, actor)
  returning id into new_assignment_id;
  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (new_assignment_id, 'assigned', actor, nullif(btrim(note), ''));
  return new_assignment_id;
end; $$;
revoke all on function public.admin_assign_delivery(uuid, uuid, text) from public, anon;
grant execute on function public.admin_assign_delivery(uuid, uuid, text) to authenticated;

create or replace function public.admin_cancel_delivery_assignment(assignment_uuid uuid, reason text default null)
returns void language plpgsql security definer set search_path = public, private as $$
declare actor uuid := auth.uid(); current_status public.delivery_assignment_status;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select status into current_status from public.delivery_assignments where id = assignment_uuid for update;
  if not found then raise exception 'Asignación no encontrada.' using errcode = 'P0001'; end if;
  if current_status in ('delivered', 'cancelled') then raise exception 'La asignación ya está cerrada.' using errcode = '22023'; end if;
  update public.delivery_assignments set status = 'cancelled', cancelled_at = timezone('utc', now()),
    cancellation_reason = coalesce(nullif(btrim(reason), ''), 'Cancelación administrativa') where id = assignment_uuid;
  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (assignment_uuid, 'cancelled', actor, coalesce(nullif(btrim(reason), ''), 'Cancelación administrativa'));
end; $$;
revoke all on function public.admin_cancel_delivery_assignment(uuid, text) from public, anon;
grant execute on function public.admin_cancel_delivery_assignment(uuid, text) to authenticated;

create or replace function public.driver_advance_delivery(assignment_uuid uuid, next_status public.delivery_assignment_status, note text default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  driver uuid := private.current_delivery_driver_id();
  current_assignment public.delivery_assignments%rowtype;
  allowed boolean := false;
  stamp timestamptz := timezone('utc', now());
begin
  if driver is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into current_assignment from public.delivery_assignments where id = assignment_uuid and driver_id = driver for update;
  if not found then raise exception 'Asignación no encontrada.' using errcode = 'P0001'; end if;
  allowed :=
    (current_assignment.status = 'assigned' and next_status = 'accepted') or
    (current_assignment.status = 'accepted' and next_status = 'picked_up') or
    (current_assignment.status = 'picked_up' and next_status = 'in_transit') or
    (current_assignment.status = 'in_transit' and next_status = 'delivered');
  if not allowed then raise exception 'Transición de estado no permitida.' using errcode = '22023'; end if;
  update public.delivery_assignments set status = next_status,
    accepted_at = case when next_status = 'accepted' then stamp else accepted_at end,
    picked_up_at = case when next_status = 'picked_up' then stamp else picked_up_at end,
    in_transit_at = case when next_status = 'in_transit' then stamp else in_transit_at end,
    delivered_at = case when next_status = 'delivered' then stamp else delivered_at end
  where id = assignment_uuid;
  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (assignment_uuid, next_status, driver, nullif(btrim(note), ''));
  if next_status in ('picked_up', 'in_transit') then
    update public.orders set status = 'en_camino' where id = current_assignment.order_id and status not in ('cancelado', 'entregado');
  elsif next_status = 'delivered' then
    update public.orders set status = 'entregado' where id = current_assignment.order_id and status <> 'cancelado';
  end if;
  return jsonb_build_object('assignmentId', assignment_uuid, 'status', next_status, 'updatedAt', stamp);
end; $$;
revoke all on function public.driver_advance_delivery(uuid, public.delivery_assignment_status, text) from public, anon;
grant execute on function public.driver_advance_delivery(uuid, public.delivery_assignment_status, text) to authenticated;

create or replace function public.admin_create_delivery_settlement(driver_uuid uuid, from_ts timestamptz, to_ts timestamptz, settlement_notes text default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare actor uuid := auth.uid(); settlement_uuid uuid; inserted_count integer;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if from_ts is null or to_ts is null or to_ts <= from_ts then raise exception 'Período de liquidación inválido.' using errcode = '22023'; end if;
  if not exists (select 1 from public.delivery_drivers where profile_id = driver_uuid) then raise exception 'Repartidor no encontrado.' using errcode = 'P0001'; end if;
  insert into public.delivery_settlements(driver_id, period_from, period_to, notes, created_by)
  values (driver_uuid, from_ts, to_ts, nullif(btrim(settlement_notes), ''), actor) returning id into settlement_uuid;
  insert into public.delivery_settlement_items(settlement_id, assignment_id, commission_amount_snapshot, cash_collected_snapshot)
  select settlement_uuid, da.id, da.commission_amount, da.cash_to_collect from public.delivery_assignments da
  where da.driver_id = driver_uuid and da.status = 'delivered' and da.delivered_at >= from_ts and da.delivered_at < to_ts
    and not exists (select 1 from public.delivery_settlement_items dsi where dsi.assignment_id = da.id);
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    delete from public.delivery_settlements where id = settlement_uuid;
    raise exception 'No hay entregas pendientes para liquidar en el período seleccionado.' using errcode = 'P0001';
  end if;
  return settlement_uuid;
end; $$;
revoke all on function public.admin_create_delivery_settlement(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.admin_create_delivery_settlement(uuid, timestamptz, timestamptz, text) to authenticated;

create or replace function public.admin_mark_delivery_settlement_paid(settlement_uuid uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  update public.delivery_settlements set status = 'paid', paid_at = timezone('utc', now()), paid_by = auth.uid()
  where id = settlement_uuid and status = 'draft';
  if not found then raise exception 'La liquidación no existe o ya está cerrada.' using errcode = 'P0001'; end if;
end; $$;
revoke all on function public.admin_mark_delivery_settlement_paid(uuid) from public, anon;
grant execute on function public.admin_mark_delivery_settlement_paid(uuid) to authenticated;

create or replace function public.admin_cancel_delivery_settlement(settlement_uuid uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if not exists (select 1 from public.delivery_settlements where id = settlement_uuid and status = 'draft') then
    raise exception 'La liquidación no existe o ya está cerrada.' using errcode = 'P0001';
  end if;
  delete from public.delivery_settlement_items where settlement_id = settlement_uuid;
  update public.delivery_settlements set status = 'cancelled' where id = settlement_uuid;
end; $$;
revoke all on function public.admin_cancel_delivery_settlement(uuid) from public, anon;
grant execute on function public.admin_cancel_delivery_settlement(uuid) to authenticated;

create or replace function public.get_delivery_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, private, auth as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'unassignedOrders', (select count(*) from public.orders o where o.delivery_method = 'delivery' and o.status not in ('cancelado', 'entregado') and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')),
      'activeAssignments', (select count(*) from public.delivery_assignments where status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'activeDrivers', (select count(*) from public.delivery_drivers where active = true),
      'pendingCommission', coalesce((select sum(da.commission_amount) from public.delivery_assignments da where da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0),
      'cashPending', coalesce((select sum(da.cash_to_collect) from public.delivery_assignments da where da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
    ),
    'drivers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.profile_id, 'fullName', p.full_name, 'email', au.email, 'phone', d.phone, 'vehicleType', d.vehicle_type,
        'active', d.active, 'commissionPercent', r.commission_percent,
        'activeAssignments', (select count(*) from public.delivery_assignments da where da.driver_id = d.profile_id and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
        'deliveredCount', (select count(*) from public.delivery_assignments da where da.driver_id = d.profile_id and da.status = 'delivered'),
        'pendingCommission', coalesce((select sum(da.commission_amount) from public.delivery_assignments da where da.driver_id = d.profile_id and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
      ) order by p.full_name)
      from public.delivery_drivers d
      join public.profiles p on p.id = d.profile_id
      left join auth.users au on au.id = d.profile_id
      left join lateral (select commission_percent from public.delivery_driver_rates rr where rr.driver_id = d.profile_id and rr.valid_to is null order by rr.valid_from desc limit 1) r on true
    ), '[]'::jsonb),
    'unassignedOrders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'orderCode', o.order_code, 'customerName', o.customer_name, 'customerPhone', o.customer_phone,
        'address', o.address, 'mapsUrl', o.delivery_maps_url, 'distanceKm', o.delivery_distance_km,
        'deliveryCost', o.delivery_cost, 'total', o.total, 'paymentMethod', o.payment_method, 'status', o.status, 'createdAt', o.created_at
      ) order by o.created_at asc)
      from public.orders o where o.delivery_method = 'delivery' and o.status not in ('cancelado', 'entregado')
        and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', da.id, 'orderId', da.order_id, 'orderCode', o.order_code, 'customerName', o.customer_name,
        'customerPhone', o.customer_phone, 'address', o.address, 'mapsUrl', o.delivery_maps_url, 'distanceKm', o.delivery_distance_km,
        'orderTotal', o.total, 'paymentMethod', o.payment_method, 'driverId', da.driver_id, 'driverName', p.full_name,
        'status', da.status, 'deliveryFee', da.delivery_fee_snapshot, 'commissionPercent', da.commission_percent_snapshot,
        'commissionAmount', da.commission_amount, 'cashToCollect', da.cash_to_collect, 'assignedAt', da.assigned_at,
        'acceptedAt', da.accepted_at, 'pickedUpAt', da.picked_up_at, 'inTransitAt', da.in_transit_at, 'deliveredAt', da.delivered_at
      ) order by da.assigned_at desc)
      from public.delivery_assignments da join public.orders o on o.id = da.order_id join public.profiles p on p.id = da.driver_id
      where da.assigned_at >= timezone('utc', now()) - interval '30 days' or da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ds.id, 'driverId', ds.driver_id, 'driverName', p.full_name, 'periodFrom', ds.period_from, 'periodTo', ds.period_to,
        'status', ds.status, 'notes', ds.notes, 'createdAt', ds.created_at, 'paidAt', ds.paid_at,
        'deliveries', count(dsi.assignment_id), 'commissionTotal', coalesce(sum(dsi.commission_amount_snapshot), 0),
        'cashCollected', coalesce(sum(dsi.cash_collected_snapshot), 0),
        'netBalance', coalesce(sum(dsi.commission_amount_snapshot - dsi.cash_collected_snapshot), 0)
      ) order by ds.created_at desc)
      from public.delivery_settlements ds join public.profiles p on p.id = ds.driver_id
      left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id
      group by ds.id, p.full_name limit 50
    ), '[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_delivery_admin_dashboard() from public, anon;
grant execute on function public.get_delivery_admin_dashboard() to authenticated;

create or replace function public.get_delivery_driver_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, private, auth as $$
declare driver uuid := private.current_delivery_driver_id(); result jsonb;
begin
  if driver is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'driver', (select jsonb_build_object('id', d.profile_id, 'fullName', p.full_name, 'email', au.email, 'phone', d.phone, 'vehicleType', d.vehicle_type, 'commissionPercent', r.commission_percent)
      from public.delivery_drivers d join public.profiles p on p.id = d.profile_id left join auth.users au on au.id = d.profile_id
      left join lateral (select commission_percent from public.delivery_driver_rates rr where rr.driver_id = d.profile_id and rr.valid_to is null order by rr.valid_from desc limit 1) r on true
      where d.profile_id = driver),
    'summary', jsonb_build_object(
      'activeAssignments', (select count(*) from public.delivery_assignments where driver_id = driver and status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'todayCommission', coalesce((select sum(commission_amount) from public.delivery_assignments where driver_id = driver and status = 'delivered' and delivered_at >= date_trunc('day', timezone('utc', now()))), 0),
      'monthCommission', coalesce((select sum(commission_amount) from public.delivery_assignments where driver_id = driver and status = 'delivered' and delivered_at >= date_trunc('month', timezone('utc', now()))), 0),
      'pendingCommission', coalesce((select sum(da.commission_amount) from public.delivery_assignments da where da.driver_id = driver and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0),
      'cashPending', coalesce((select sum(da.cash_to_collect) from public.delivery_assignments da where da.driver_id = driver and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
    ),
    'activeAssignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', da.id, 'orderId', da.order_id, 'orderCode', o.order_code, 'customerName', o.customer_name, 'customerPhone', o.customer_phone,
        'address', o.address, 'mapsUrl', o.delivery_maps_url, 'distanceKm', o.delivery_distance_km, 'orderTotal', o.total,
        'paymentMethod', o.payment_method, 'notes', o.notes, 'status', da.status, 'deliveryFee', da.delivery_fee_snapshot,
        'commissionPercent', da.commission_percent_snapshot, 'commissionAmount', da.commission_amount,
        'cashToCollect', da.cash_to_collect, 'assignedAt', da.assigned_at
      ) order by da.assigned_at asc)
      from public.delivery_assignments da join public.orders o on o.id = da.order_id
      where da.driver_id = driver and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ), '[]'::jsonb),
    'recentDeliveries', coalesce((
      select jsonb_agg(jsonb_build_object('id', da.id, 'orderCode', o.order_code, 'customerName', o.customer_name, 'commissionAmount', da.commission_amount, 'cashToCollect', da.cash_to_collect, 'deliveredAt', da.delivered_at) order by da.delivered_at desc)
      from (select * from public.delivery_assignments where driver_id = driver and status = 'delivered' order by delivered_at desc limit 20) da
      join public.orders o on o.id = da.order_id
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ds.id, 'periodFrom', ds.period_from, 'periodTo', ds.period_to, 'status', ds.status, 'createdAt', ds.created_at, 'paidAt', ds.paid_at,
        'deliveries', count(dsi.assignment_id), 'commissionTotal', coalesce(sum(dsi.commission_amount_snapshot), 0),
        'cashCollected', coalesce(sum(dsi.cash_collected_snapshot), 0), 'netBalance', coalesce(sum(dsi.commission_amount_snapshot - dsi.cash_collected_snapshot), 0)
      ) order by ds.created_at desc)
      from public.delivery_settlements ds left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id
      where ds.driver_id = driver group by ds.id limit 20
    ), '[]'::jsonb)
  ) into result;
  return result;
end; $$;
revoke all on function public.get_delivery_driver_dashboard() from public, anon;
grant execute on function public.get_delivery_driver_dashboard() to authenticated;

create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);
create index if not exists order_notification_reads_order_idx on public.order_notification_reads(order_id);
create index if not exists order_status_history_changed_by_idx on public.order_status_history(changed_by);

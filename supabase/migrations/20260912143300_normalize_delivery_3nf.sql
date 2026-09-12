alter table public.delivery_assignments
  add column if not exists rate_id uuid references public.delivery_driver_rates(id) on delete restrict;

update public.delivery_assignments da
set rate_id = coalesce(
  (
    select r.id
    from public.delivery_driver_rates r
    where r.driver_id = da.driver_id
      and r.valid_from <= da.assigned_at
      and (r.valid_to is null or r.valid_to > da.assigned_at)
    order by r.valid_from desc
    limit 1
  ),
  (
    select r.id
    from public.delivery_driver_rates r
    where r.driver_id = da.driver_id
    order by r.valid_from desc
    limit 1
  )
)
where da.rate_id is null;

alter table public.delivery_assignments alter column rate_id set not null;

create or replace function public.admin_assign_delivery(order_uuid uuid, driver_uuid uuid, note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  target_order public.orders%rowtype;
  selected_rate public.delivery_driver_rates%rowtype;
  current_assignment_id uuid;
  current_driver_id uuid;
  new_assignment_id uuid;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into target_order from public.orders where id = order_uuid for update;
  if not found then raise exception 'Pedido no encontrado.' using errcode = 'P0001'; end if;
  if target_order.delivery_method <> 'delivery' then raise exception 'El pedido no es delivery.' using errcode = '22023'; end if;
  if target_order.status in ('cancelado', 'entregado') then raise exception 'El pedido ya no admite asignación.' using errcode = '22023'; end if;

  if not exists (
    select 1 from public.delivery_drivers d
    join public.profiles p on p.id = d.profile_id
    where d.profile_id = driver_uuid and d.active = true and p.active = true and p.role::text = 'delivery'
  ) then raise exception 'El repartidor no está disponible.' using errcode = 'P0001'; end if;

  select * into selected_rate
  from public.delivery_driver_rates
  where driver_id = driver_uuid
    and valid_from <= timezone('utc', now())
    and (valid_to is null or valid_to > timezone('utc', now()))
  order by valid_from desc limit 1;
  if selected_rate.id is null then raise exception 'El repartidor no tiene una comisión vigente.' using errcode = 'P0001'; end if;

  select da.id, r.driver_id into current_assignment_id, current_driver_id
  from public.delivery_assignments da
  join public.delivery_driver_rates r on r.id = da.rate_id
  where da.order_id = order_uuid and da.status <> 'cancelled'
  order by da.assigned_at desc limit 1 for update of da;

  if current_assignment_id is not null and current_driver_id = driver_uuid then return current_assignment_id; end if;
  if current_assignment_id is not null then
    update public.delivery_assignments
    set status = 'cancelled', cancelled_at = timezone('utc', now()),
        cancellation_reason = coalesce(nullif(btrim(note), ''), 'Reasignación administrativa')
    where id = current_assignment_id;
    insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
    values (current_assignment_id, 'cancelled', actor, coalesce(nullif(btrim(note), ''), 'Reasignación administrativa'));
  end if;

  insert into public.delivery_assignments(order_id, rate_id, status, assigned_by)
  values (order_uuid, selected_rate.id, 'assigned', actor)
  returning id into new_assignment_id;
  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (new_assignment_id, 'assigned', actor, nullif(btrim(note), ''));
  return new_assignment_id;
end;
$$;

create or replace function public.driver_advance_delivery(assignment_uuid uuid, next_status public.delivery_assignment_status, note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  driver uuid := private.current_delivery_driver_id();
  current_assignment public.delivery_assignments%rowtype;
  allowed boolean := false;
  stamp timestamptz := timezone('utc', now());
begin
  if driver is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select da.* into current_assignment
  from public.delivery_assignments da
  join public.delivery_driver_rates r on r.id = da.rate_id
  where da.id = assignment_uuid and r.driver_id = driver
  for update of da;
  if not found then raise exception 'Asignación no encontrada.' using errcode = 'P0001'; end if;

  allowed :=
    (current_assignment.status = 'assigned' and next_status = 'accepted') or
    (current_assignment.status = 'accepted' and next_status = 'picked_up') or
    (current_assignment.status = 'picked_up' and next_status = 'in_transit') or
    (current_assignment.status = 'in_transit' and next_status = 'delivered');
  if not allowed then raise exception 'Transición de estado no permitida.' using errcode = '22023'; end if;

  update public.delivery_assignments
  set status = next_status,
      accepted_at = case when next_status = 'accepted' then stamp else accepted_at end,
      picked_up_at = case when next_status = 'picked_up' then stamp else picked_up_at end,
      in_transit_at = case when next_status = 'in_transit' then stamp else in_transit_at end,
      delivered_at = case when next_status = 'delivered' then stamp else delivered_at end
  where id = assignment_uuid;
  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (assignment_uuid, next_status, driver, nullif(btrim(note), ''));

  if next_status in ('picked_up', 'in_transit') then
    update public.orders set status = 'en_camino'
    where id = current_assignment.order_id and status not in ('cancelado', 'entregado');
  elsif next_status = 'delivered' then
    update public.orders set status = 'entregado'
    where id = current_assignment.order_id and status <> 'cancelado';
  end if;
  return jsonb_build_object('assignmentId', assignment_uuid, 'status', next_status, 'updatedAt', stamp);
end;
$$;

create or replace function public.admin_create_delivery_settlement(driver_uuid uuid, from_ts timestamptz, to_ts timestamptz, settlement_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare actor uuid := auth.uid(); settlement_uuid uuid; inserted_count integer;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if from_ts is null or to_ts is null or to_ts <= from_ts then raise exception 'Período de liquidación inválido.' using errcode = '22023'; end if;
  if not exists (select 1 from public.delivery_drivers where profile_id = driver_uuid) then raise exception 'Repartidor no encontrado.' using errcode = 'P0001'; end if;

  insert into public.delivery_settlements(driver_id, period_from, period_to, notes, created_by)
  values (driver_uuid, from_ts, to_ts, nullif(btrim(settlement_notes), ''), actor)
  returning id into settlement_uuid;

  insert into public.delivery_settlement_items(settlement_id, assignment_id)
  select settlement_uuid, da.id
  from public.delivery_assignments da
  join public.delivery_driver_rates r on r.id = da.rate_id
  where r.driver_id = driver_uuid
    and da.status = 'delivered'
    and da.delivered_at >= from_ts and da.delivered_at < to_ts
    and not exists (select 1 from public.delivery_settlement_items dsi where dsi.assignment_id = da.id);
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    delete from public.delivery_settlements where id = settlement_uuid;
    raise exception 'No hay entregas pendientes para liquidar en el período seleccionado.' using errcode = 'P0001';
  end if;
  return settlement_uuid;
end;
$$;

create or replace function public.get_delivery_admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth
as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'unassignedOrders', (select count(*) from public.orders o where o.delivery_method = 'delivery' and o.status not in ('cancelado', 'entregado') and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')),
      'activeAssignments', (select count(*) from public.delivery_assignments where status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'activeDrivers', (select count(*) from public.delivery_drivers where active = true),
      'pendingCommission', coalesce((select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id where da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0),
      'cashPending', coalesce((select sum(case when o.payment_method = 'efectivo' then o.total else 0 end) from public.delivery_assignments da join public.orders o on o.id = da.order_id where da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
    ),
    'drivers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.profile_id, 'fullName', p.full_name, 'email', au.email, 'phone', d.phone, 'vehicleType', d.vehicle_type,
        'active', d.active, 'commissionPercent', current_rate.commission_percent,
        'activeAssignments', (select count(*) from public.delivery_assignments da join public.delivery_driver_rates ar on ar.id = da.rate_id where ar.driver_id = d.profile_id and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
        'deliveredCount', (select count(*) from public.delivery_assignments da join public.delivery_driver_rates ar on ar.id = da.rate_id where ar.driver_id = d.profile_id and da.status = 'delivered'),
        'pendingCommission', coalesce((select sum(round((o.delivery_cost * ar.commission_percent / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_driver_rates ar on ar.id = da.rate_id join public.orders o on o.id = da.order_id where ar.driver_id = d.profile_id and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
      ) order by p.full_name)
      from public.delivery_drivers d
      join public.profiles p on p.id = d.profile_id
      left join auth.users au on au.id = d.profile_id
      left join lateral (select commission_percent from public.delivery_driver_rates rr where rr.driver_id = d.profile_id and rr.valid_to is null order by rr.valid_from desc limit 1) current_rate on true
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
        'orderTotal', o.total, 'paymentMethod', o.payment_method, 'driverId', r.driver_id, 'driverName', p.full_name,
        'status', da.status, 'deliveryFee', o.delivery_cost, 'commissionPercent', r.commission_percent,
        'commissionAmount', round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2),
        'cashToCollect', case when o.payment_method = 'efectivo' then o.total else 0 end,
        'assignedAt', da.assigned_at, 'acceptedAt', da.accepted_at, 'pickedUpAt', da.picked_up_at,
        'inTransitAt', da.in_transit_at, 'deliveredAt', da.delivered_at
      ) order by da.assigned_at desc)
      from public.delivery_assignments da
      join public.delivery_driver_rates r on r.id = da.rate_id
      join public.orders o on o.id = da.order_id
      join public.profiles p on p.id = r.driver_id
      where da.assigned_at >= timezone('utc', now()) - interval '30 days' or da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ds.id, 'driverId', ds.driver_id, 'driverName', p.full_name, 'periodFrom', ds.period_from, 'periodTo', ds.period_to,
        'status', ds.status, 'notes', ds.notes, 'createdAt', ds.created_at, 'paidAt', ds.paid_at,
        'deliveries', count(dsi.assignment_id),
        'commissionTotal', coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)), 0),
        'cashCollected', coalesce(sum(case when o.payment_method = 'efectivo' then o.total else 0 end), 0),
        'netBalance', coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2) - case when o.payment_method = 'efectivo' then o.total else 0 end), 0)
      ) order by ds.created_at desc)
      from public.delivery_settlements ds
      join public.profiles p on p.id = ds.driver_id
      left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id
      left join public.delivery_assignments da on da.id = dsi.assignment_id
      left join public.delivery_driver_rates r on r.id = da.rate_id
      left join public.orders o on o.id = da.order_id
      group by ds.id, p.full_name limit 50
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_delivery_driver_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth
as $$
declare driver uuid := private.current_delivery_driver_id(); result jsonb;
begin
  if driver is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'driver', (select jsonb_build_object('id', d.profile_id, 'fullName', p.full_name, 'email', au.email, 'phone', d.phone, 'vehicleType', d.vehicle_type, 'commissionPercent', current_rate.commission_percent)
      from public.delivery_drivers d join public.profiles p on p.id = d.profile_id left join auth.users au on au.id = d.profile_id
      left join lateral (select commission_percent from public.delivery_driver_rates rr where rr.driver_id = d.profile_id and rr.valid_to is null order by rr.valid_from desc limit 1) current_rate on true
      where d.profile_id = driver),
    'summary', jsonb_build_object(
      'activeAssignments', (select count(*) from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id where r.driver_id = driver and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'todayCommission', coalesce((select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id where r.driver_id = driver and da.status = 'delivered' and da.delivered_at >= date_trunc('day', timezone('utc', now()))), 0),
      'monthCommission', coalesce((select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id where r.driver_id = driver and da.status = 'delivered' and da.delivered_at >= date_trunc('month', timezone('utc', now()))), 0),
      'pendingCommission', coalesce((select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id where r.driver_id = driver and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0),
      'cashPending', coalesce((select sum(case when o.payment_method = 'efectivo' then o.total else 0 end) from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id where r.driver_id = driver and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
    ),
    'activeAssignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', da.id, 'orderId', da.order_id, 'orderCode', o.order_code, 'customerName', o.customer_name,
        'customerPhone', o.customer_phone, 'address', o.address, 'mapsUrl', o.delivery_maps_url, 'distanceKm', o.delivery_distance_km,
        'orderTotal', o.total, 'paymentMethod', o.payment_method, 'notes', o.notes, 'status', da.status,
        'deliveryFee', o.delivery_cost, 'commissionPercent', r.commission_percent,
        'commissionAmount', round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2),
        'cashToCollect', case when o.payment_method = 'efectivo' then o.total else 0 end, 'assignedAt', da.assigned_at
      ) order by da.assigned_at asc)
      from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id
      where r.driver_id = driver and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ), '[]'::jsonb),
    'recentDeliveries', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'orderCode', q.order_code, 'customerName', q.customer_name, 'commissionAmount', q.commission_amount, 'cashToCollect', q.cash_to_collect, 'deliveredAt', q.delivered_at) order by q.delivered_at desc)
      from (
        select da.id, o.order_code, o.customer_name,
          round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2) as commission_amount,
          case when o.payment_method = 'efectivo' then o.total else 0 end as cash_to_collect,
          da.delivered_at
        from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id
        where r.driver_id = driver and da.status = 'delivered' order by da.delivered_at desc limit 20
      ) q
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ds.id, 'periodFrom', ds.period_from, 'periodTo', ds.period_to, 'status', ds.status, 'createdAt', ds.created_at, 'paidAt', ds.paid_at,
        'deliveries', count(dsi.assignment_id),
        'commissionTotal', coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)), 0),
        'cashCollected', coalesce(sum(case when o.payment_method = 'efectivo' then o.total else 0 end), 0),
        'netBalance', coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2) - case when o.payment_method = 'efectivo' then o.total else 0 end), 0)
      ) order by ds.created_at desc)
      from public.delivery_settlements ds
      left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id
      left join public.delivery_assignments da on da.id = dsi.assignment_id
      left join public.delivery_driver_rates r on r.id = da.rate_id
      left join public.orders o on o.id = da.order_id
      where ds.driver_id = driver group by ds.id limit 20
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

drop policy if exists delivery_assignments_admin_or_self_select on public.delivery_assignments;
create policy delivery_assignments_admin_or_self_select on public.delivery_assignments for select to authenticated
using ((select private.is_admin()) or exists (select 1 from public.delivery_driver_rates r where r.id = rate_id and r.driver_id = (select private.current_delivery_driver_id())));

drop policy if exists delivery_assignment_events_admin_or_self_select on public.delivery_assignment_events;
create policy delivery_assignment_events_admin_or_self_select on public.delivery_assignment_events for select to authenticated
using ((select private.is_admin()) or exists (
  select 1 from public.delivery_assignments da join public.delivery_driver_rates r on r.id = da.rate_id
  where da.id = assignment_id and r.driver_id = (select private.current_delivery_driver_id())
));

drop index if exists public.delivery_assignments_driver_status_idx;
drop index if exists public.delivery_assignments_delivered_idx;
create index if not exists delivery_assignments_rate_status_idx on public.delivery_assignments(rate_id, status, assigned_at desc);
create index if not exists delivery_assignments_rate_delivered_idx on public.delivery_assignments(rate_id, delivered_at desc) where status = 'delivered';

alter table public.delivery_assignments
  drop column if exists delivery_fee_snapshot,
  drop column if exists commission_percent_snapshot,
  drop column if exists commission_amount,
  drop column if exists cash_to_collect,
  drop column if exists driver_id;

alter table public.delivery_settlement_items
  drop column if exists commission_amount_snapshot,
  drop column if exists cash_collected_snapshot;

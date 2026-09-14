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
      'unassignedOrders', (
        select count(*) from public.orders o
        where o.delivery_method = 'delivery'
          and o.status not in ('cancelado', 'entregado')
          and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')
      ),
      'activeAssignments', (select count(*) from public.delivery_assignments where status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'activeDrivers', (
        select count(*) from public.delivery_drivers d join public.profiles p on p.id = d.profile_id
        where d.active = true and p.active = true and p.archived_at is null
      ),
      'pendingCommission', coalesce((
        select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2))
        from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        join public.orders o on o.id = da.order_id
        where da.status = 'delivered'
          and not exists (
            select 1 from public.delivery_settlement_items dsi
            join public.delivery_settlements ds on ds.id = dsi.settlement_id
            where dsi.assignment_id = da.id and ds.status = 'paid'
          )
      ), 0),
      'cashPending', coalesce((
        select sum(case when o.payment_method = 'efectivo' then o.total else 0 end)
        from public.delivery_assignments da
        join public.orders o on o.id = da.order_id
        where da.status = 'delivered'
          and not exists (
            select 1 from public.delivery_settlement_items dsi
            join public.delivery_settlements ds on ds.id = dsi.settlement_id
            where dsi.assignment_id = da.id and ds.status = 'paid'
          )
      ), 0)
    ),
    'drivers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.profile_id,
        'fullName', p.full_name,
        'email', au.email,
        'phone', p.phone,
        'vehicleType', d.vehicle_type,
        'active', d.active and p.active and p.archived_at is null,
        'commissionPercent', current_rate.commission_percent,
        'activeAssignments', (
          select count(*) from public.delivery_assignments da
          join public.delivery_driver_rates ar on ar.id = da.rate_id
          where ar.driver_id = d.profile_id and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
        ),
        'deliveredCount', (
          select count(*) from public.delivery_assignments da
          join public.delivery_driver_rates ar on ar.id = da.rate_id
          where ar.driver_id = d.profile_id and da.status = 'delivered'
        ),
        'pendingCommission', coalesce((
          select sum(round((o.delivery_cost * ar.commission_percent / 100.0)::numeric, 2))
          from public.delivery_assignments da
          join public.delivery_driver_rates ar on ar.id = da.rate_id
          join public.orders o on o.id = da.order_id
          where ar.driver_id = d.profile_id and da.status = 'delivered'
            and not exists (
              select 1 from public.delivery_settlement_items dsi
              join public.delivery_settlements ds on ds.id = dsi.settlement_id
              where dsi.assignment_id = da.id and ds.status = 'paid'
            )
        ), 0)
      ) order by p.full_name)
      from public.delivery_drivers d
      join public.profiles p on p.id = d.profile_id
      left join auth.users au on au.id = d.profile_id
      left join lateral (
        select commission_percent from public.delivery_driver_rates rr
        where rr.driver_id = d.profile_id and rr.valid_to is null
        order by rr.valid_from desc limit 1
      ) current_rate on true
    ), '[]'::jsonb),
    'unassignedOrders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'orderCode', o.order_code, 'customerName', o.customer_name,
        'customerPhone', o.customer_phone, 'address', o.address, 'mapsUrl', o.delivery_maps_url,
        'distanceKm', o.delivery_distance_km, 'deliveryCost', o.delivery_cost, 'total', o.total,
        'paymentMethod', o.payment_method, 'status', o.status, 'createdAt', o.created_at
      ) order by o.created_at asc)
      from public.orders o
      where o.delivery_method = 'delivery'
        and o.status not in ('cancelado', 'entregado')
        and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', da.id, 'orderId', da.order_id, 'orderCode', o.order_code, 'customerName', o.customer_name,
        'customerPhone', o.customer_phone, 'address', o.address, 'mapsUrl', o.delivery_maps_url,
        'distanceKm', o.delivery_distance_km, 'orderTotal', o.total, 'paymentMethod', o.payment_method,
        'driverId', r.driver_id, 'driverName', p.full_name, 'status', da.status,
        'deliveryFee', o.delivery_cost, 'commissionPercent', r.commission_percent,
        'commissionAmount', round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2),
        'cashToCollect', case when o.payment_method = 'efectivo' then o.total else 0 end,
        'assignedAt', da.assigned_at, 'acceptedAt', da.accepted_at, 'pickedUpAt', da.picked_up_at,
        'inTransitAt', da.in_transit_at, 'deliveredAt', da.delivered_at
      ) order by da.assigned_at desc)
      from public.delivery_assignments da
      join public.delivery_driver_rates r on r.id = da.rate_id
      join public.orders o on o.id = da.order_id
      join public.profiles p on p.id = r.driver_id
      where da.assigned_at >= timezone('utc', now()) - interval '30 days'
         or da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'driverId', q.driver_id,
        'driverName', q.driver_name,
        'periodFrom', q.period_from,
        'periodTo', q.period_to,
        'status', q.status,
        'notes', q.notes,
        'createdAt', q.created_at,
        'paidAt', q.paid_at,
        'deliveries', q.deliveries,
        'commissionTotal', q.commission_total,
        'cashCollected', q.cash_collected,
        'netBalance', q.net_balance
      ) order by q.created_at desc)
      from (
        select ds.id, ds.driver_id, p.full_name as driver_name, ds.period_from, ds.period_to,
          ds.status, ds.notes, ds.created_at, ds.paid_at,
          count(dsi.assignment_id) as deliveries,
          coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)), 0) as commission_total,
          coalesce(sum(case when o.payment_method = 'efectivo' then o.total else 0 end), 0) as cash_collected,
          coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2) - case when o.payment_method = 'efectivo' then o.total else 0 end), 0) as net_balance
        from public.delivery_settlements ds
        join public.profiles p on p.id = ds.driver_id
        left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id
        left join public.delivery_assignments da on da.id = dsi.assignment_id
        left join public.delivery_driver_rates r on r.id = da.rate_id
        left join public.orders o on o.id = da.order_id
        group by ds.id, p.full_name
        order by ds.created_at desc
        limit 50
      ) q
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
    'driver', (
      select jsonb_build_object(
        'id', d.profile_id, 'fullName', p.full_name, 'email', au.email, 'phone', p.phone,
        'vehicleType', d.vehicle_type, 'commissionPercent', current_rate.commission_percent
      )
      from public.delivery_drivers d
      join public.profiles p on p.id = d.profile_id
      left join auth.users au on au.id = d.profile_id
      left join lateral (
        select commission_percent from public.delivery_driver_rates rr
        where rr.driver_id = d.profile_id and rr.valid_to is null
        order by rr.valid_from desc limit 1
      ) current_rate on true
      where d.profile_id = driver
    ),
    'summary', jsonb_build_object(
      'activeAssignments', (
        select count(*) from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        where r.driver_id = driver and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
      ),
      'todayCommission', coalesce((
        select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2))
        from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        join public.orders o on o.id = da.order_id
        where r.driver_id = driver and da.status = 'delivered'
          and da.delivered_at >= date_trunc('day', timezone('utc', now()))
      ), 0),
      'monthCommission', coalesce((
        select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2))
        from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        join public.orders o on o.id = da.order_id
        where r.driver_id = driver and da.status = 'delivered'
          and da.delivered_at >= date_trunc('month', timezone('utc', now()))
      ), 0),
      'pendingCommission', coalesce((
        select sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2))
        from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        join public.orders o on o.id = da.order_id
        where r.driver_id = driver and da.status = 'delivered'
          and not exists (
            select 1 from public.delivery_settlement_items dsi
            join public.delivery_settlements ds on ds.id = dsi.settlement_id
            where dsi.assignment_id = da.id and ds.status = 'paid'
          )
      ), 0),
      'cashPending', coalesce((
        select sum(case when o.payment_method = 'efectivo' then o.total else 0 end)
        from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        join public.orders o on o.id = da.order_id
        where r.driver_id = driver and da.status = 'delivered'
          and not exists (
            select 1 from public.delivery_settlement_items dsi
            join public.delivery_settlements ds on ds.id = dsi.settlement_id
            where dsi.assignment_id = da.id and ds.status = 'paid'
          )
      ), 0)
    ),
    'activeAssignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', da.id, 'orderId', da.order_id, 'orderCode', o.order_code, 'customerName', o.customer_name,
        'customerPhone', o.customer_phone, 'address', o.address, 'mapsUrl', o.delivery_maps_url,
        'distanceKm', o.delivery_distance_km, 'orderTotal', o.total, 'paymentMethod', o.payment_method,
        'notes', o.notes, 'status', da.status, 'deliveryFee', o.delivery_cost,
        'commissionPercent', r.commission_percent,
        'commissionAmount', round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2),
        'cashToCollect', case when o.payment_method = 'efectivo' then o.total else 0 end,
        'assignedAt', da.assigned_at
      ) order by da.assigned_at asc)
      from public.delivery_assignments da
      join public.delivery_driver_rates r on r.id = da.rate_id
      join public.orders o on o.id = da.order_id
      where r.driver_id = driver and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')
    ), '[]'::jsonb),
    'recentDeliveries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'orderCode', q.order_code, 'customerName', q.customer_name,
        'commissionAmount', q.commission_amount, 'cashToCollect', q.cash_to_collect,
        'deliveredAt', q.delivered_at
      ) order by q.delivered_at desc)
      from (
        select da.id, o.order_code, o.customer_name,
          round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2) as commission_amount,
          case when o.payment_method = 'efectivo' then o.total else 0 end as cash_to_collect,
          da.delivered_at
        from public.delivery_assignments da
        join public.delivery_driver_rates r on r.id = da.rate_id
        join public.orders o on o.id = da.order_id
        where r.driver_id = driver and da.status = 'delivered'
        order by da.delivered_at desc
        limit 20
      ) q
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'periodFrom', q.period_from,
        'periodTo', q.period_to,
        'status', q.status,
        'createdAt', q.created_at,
        'paidAt', q.paid_at,
        'deliveries', q.deliveries,
        'commissionTotal', q.commission_total,
        'cashCollected', q.cash_collected,
        'netBalance', q.net_balance
      ) order by q.created_at desc)
      from (
        select ds.id, ds.period_from, ds.period_to, ds.status, ds.created_at, ds.paid_at,
          count(dsi.assignment_id) as deliveries,
          coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2)), 0) as commission_total,
          coalesce(sum(case when o.payment_method = 'efectivo' then o.total else 0 end), 0) as cash_collected,
          coalesce(sum(round((o.delivery_cost * r.commission_percent / 100.0)::numeric, 2) - case when o.payment_method = 'efectivo' then o.total else 0 end), 0) as net_balance
        from public.delivery_settlements ds
        left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id
        left join public.delivery_assignments da on da.id = dsi.assignment_id
        left join public.delivery_driver_rates r on r.id = da.rate_id
        left join public.orders o on o.id = da.order_id
        where ds.driver_id = driver
        group by ds.id
        order by ds.created_at desc
        limit 20
      ) q
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

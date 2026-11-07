-- Delivery mixed-payment settlement. Additive: historical orders retain existing behavior.
create or replace function private.delivery_cash_due(target_order_id uuid)
returns numeric language sql stable security definer set search_path = ''
as $cash$
  select coalesce(
    (select p.cash_amount from public.order_payment_plans p where p.order_id=target_order_id),
    (select case when o.payment_method='efectivo' then o.total else 0 end
     from public.orders o where o.id=target_order_id),
    0
  )::numeric(12,2);
$cash$;
revoke all on function private.delivery_cash_due(uuid) from public,anon,authenticated;

-- An assignment can be accepted only after its planned transfer has been verified by the local admin.
create or replace function private.guard_mixed_delivery_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $guard$
declare p public.order_payment_plans%rowtype; o public.orders%rowtype; received numeric(12,2);
begin
  select * into o from public.orders where id=new.order_id for update;
  select * into p from public.order_payment_plans where order_id=new.order_id;
  if o.payment_preference='combinado' and not found then
    raise exception 'El pedido mixto no tiene plan de cobro.' using errcode='22023';
  end if;
  if p.order_id is not null then
    if p.cash_amount + p.transfer_amount <> o.total then
      raise exception 'La distribución del cobro no coincide con el total.' using errcode='22023';
    end if;
    select coalesce(sum(case when kind='payment' then amount else -amount end),0) into received
    from public.order_payment_movements
    where order_id=o.id and method='transferencia';
    if received < p.transfer_amount then
      raise exception 'Confirmá la transferencia acreditada antes de asignar el reparto.' using errcode='22023';
    end if;
  end if;
  return new;
end $guard$;
drop trigger if exists guard_mixed_delivery_assignment on public.delivery_assignments;
create trigger guard_mixed_delivery_assignment before insert on public.delivery_assignments
for each row execute function private.guard_mixed_delivery_assignment();

-- The delivery confirmation is also the cash receipt confirmation. Exact amount; never the whole mixed order total.
create or replace function private.record_delivery_cash_payment()
returns trigger language plpgsql security definer set search_path = ''
as $collect$
declare p public.order_payment_plans%rowtype; due numeric(12,2); id_key uuid;
begin
  if new.status <> 'delivered' or old.status='delivered' then return new; end if;
  select * into p from public.order_payment_plans where order_id=new.order_id;
  if p.order_id is null then return new; end if; -- Legacy: no synthetic payment movements.
  due := p.cash_amount;
  if due <= 0 then return new; end if;
  -- One immutable collection per assignment; replaying the update does not duplicate funds.
  insert into public.order_payment_movements(
    order_id,method,amount,kind,source,delivery_assignment_id,idempotency_key,confirmed_by
  ) values (
    new.order_id,'efectivo',due,'payment','delivery',new.id,gen_random_uuid(),auth.uid()
  );
  return new;
end $collect$;
create unique index if not exists order_payment_delivery_once on public.order_payment_movements(delivery_assignment_id)
where source='delivery' and kind='payment';
drop trigger if exists record_delivery_cash_payment on public.delivery_assignments;
create trigger record_delivery_cash_payment after update of status on public.delivery_assignments
for each row execute function private.record_delivery_cash_payment();

-- Prevent editing the total of a financial plan and canceling an order with unrefunded money.
create or replace function private.guard_order_financial_integrity()
returns trigger language plpgsql security definer set search_path = ''
as $integrity$
declare outstanding numeric(12,2);
begin
  if (old.subtotal is distinct from new.subtotal or old.delivery_cost is distinct from new.delivery_cost
      or old.payment_method is distinct from new.payment_method)
     and (exists (select 1 from public.order_payment_plans where order_id=old.id)
       or exists (select 1 from public.order_payment_movements where order_id=old.id)) then
    raise exception 'Este pedido tiene un plan/cobro registrado; no modifiques el total o medio hasta conciliarlo.' using errcode='22023';
  end if;
  if new.status='cancelado' and old.status <> 'cancelado' then
    select coalesce(sum(case when kind='payment' then amount else -amount end),0)
    into outstanding from public.order_payment_movements where order_id=old.id;
    if outstanding > 0 then
      raise exception 'El pedido tiene dinero cobrado: registrá el reintegro antes de cancelarlo.' using errcode='22023';
    end if;
  end if;
  return new;
end $integrity$;
drop trigger if exists guard_order_financial_integrity on public.orders;
create trigger guard_order_financial_integrity before update on public.orders
for each row execute function private.guard_order_financial_integrity();


-- Refreshed admin_delivery_cash_pending_details from production definition; cash computed using the plan.
CREATE OR REPLACE FUNCTION public.admin_delivery_cash_pending_details()
 RETURNS TABLE("orderCode" text, "deliveredAt" timestamp with time zone, "driverName" text, "cashAmount" numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      o.order_code::text,
      da.delivered_at,
      p.full_name::text,
      o.total::numeric
    FROM public.delivery_assignments da
    JOIN public.orders o ON o.id = da.order_id
    JOIN public.delivery_driver_rates r ON r.id = da.rate_id
    JOIN public.profiles p ON p.id = r.driver_id
    WHERE da.status = 'delivered'
      AND private.delivery_cash_due(o.id) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.delivery_settlement_items dsi
        JOIN public.delivery_settlements ds ON ds.id = dsi.settlement_id
        WHERE dsi.assignment_id = da.id AND ds.status = 'paid'
      )
    ORDER BY da.delivered_at DESC, da.id DESC;
END;
$function$



-- Refreshed get_delivery_admin_dashboard from production definition; cash computed using the plan.
CREATE OR REPLACE FUNCTION public.get_delivery_admin_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'unassignedOrders', (select count(*) from public.orders o where o.delivery_method = 'delivery' and o.status not in ('cancelado', 'entregado') and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')),
      'activeAssignments', (select count(*) from public.delivery_assignments where status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'activeDrivers', (select count(*) from public.delivery_drivers d join public.profiles p on p.id = d.profile_id where d.active = true and p.active = true and p.archived_at is null),
      'pendingCommission', coalesce((select sum(round((dac.delivery_fee_snapshot * coalesce(dac.commission_percent_override, r.commission_percent) / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id = da.id join public.delivery_driver_rates r on r.id = da.rate_id where da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0),
      'cashPending', coalesce((select sum(private.delivery_cash_due(o.id)) from public.delivery_assignments da join public.orders o on o.id = da.order_id where da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
    ),
    'drivers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', d.profile_id, 'fullName', p.full_name, 'email', au.email, 'phone', p.phone, 'vehicleType', d.vehicle_type,
      'active', d.active and p.active and p.archived_at is null, 'commissionPercent', current_rate.commission_percent,
      'activeAssignments', (select count(*) from public.delivery_assignments da join public.delivery_driver_rates ar on ar.id = da.rate_id where ar.driver_id = d.profile_id and da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')),
      'deliveredCount', (select count(*) from public.delivery_assignments da join public.delivery_driver_rates ar on ar.id = da.rate_id where ar.driver_id = d.profile_id and da.status = 'delivered'),
      'pendingCommission', coalesce((select sum(round((dac.delivery_fee_snapshot * coalesce(dac.commission_percent_override, ar.commission_percent) / 100.0)::numeric, 2)) from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id = da.id join public.delivery_driver_rates ar on ar.id = da.rate_id where ar.driver_id = d.profile_id and da.status = 'delivered' and not exists (select 1 from public.delivery_settlement_items dsi join public.delivery_settlements ds on ds.id = dsi.settlement_id where dsi.assignment_id = da.id and ds.status = 'paid')), 0)
    ) order by p.full_name)
    from public.delivery_drivers d join public.profiles p on p.id = d.profile_id left join auth.users au on au.id = d.profile_id
    left join lateral (select commission_percent from public.delivery_driver_rates rr where rr.driver_id = d.profile_id and rr.valid_to is null order by rr.valid_from desc limit 1) current_rate on true), '[]'::jsonb),
    'unassignedOrders', coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'deliveryMethod', o.delivery_method, 'orderCode', o.order_code, 'customerName', o.customer_name, 'customerPhone', o.customer_phone,
      'address', o.address, 'mapsUrl', o.delivery_maps_url, 'distanceKm', o.delivery_distance_km, 'deliveryCost', o.delivery_cost,
      'total', o.total, 'paymentMethod', o.payment_method, 'status', o.status, 'createdAt', o.created_at
    ) order by o.created_at asc) from public.orders o where o.delivery_method = 'delivery' and o.status not in ('cancelado', 'entregado') and not exists (select 1 from public.delivery_assignments da where da.order_id = o.id and da.status <> 'cancelled')), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', da.id, 'orderId', da.order_id, 'orderCode', o.order_code, 'customerName', o.customer_name,
      'customerPhone', o.customer_phone, 'address', o.address, 'mapsUrl', o.delivery_maps_url, 'distanceKm', o.delivery_distance_km,
      'orderTotal', o.total, 'paymentMethod', o.payment_method, 'driverId', r.driver_id, 'driverName', p.full_name, 'status', da.status,
      'deliveryFee', dac.delivery_fee_snapshot, 'commissionPercent', coalesce(dac.commission_percent_override, r.commission_percent),
      'commissionAmount', round((dac.delivery_fee_snapshot * coalesce(dac.commission_percent_override, r.commission_percent) / 100.0)::numeric, 2),
      'cashToCollect', private.delivery_cash_due(o.id),
      'assignedAt', da.assigned_at, 'acceptedAt', da.accepted_at, 'pickedUpAt', da.picked_up_at, 'inTransitAt', da.in_transit_at, 'deliveredAt', da.delivered_at
    ) order by da.assigned_at desc)
    from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id = da.id
    join public.delivery_driver_rates r on r.id = da.rate_id join public.orders o on o.id = da.order_id join public.profiles p on p.id = r.driver_id
    where da.assigned_at >= timezone('utc', now()) - interval '30 days' or da.status in ('assigned', 'accepted', 'picked_up', 'in_transit')), '[]'::jsonb),
    'settlements', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'driverId', q.driver_id, 'driverName', q.driver_name, 'periodFrom', q.period_from, 'periodTo', q.period_to,
      'status', q.status, 'notes', q.notes, 'createdAt', q.created_at, 'paidAt', q.paid_at, 'deliveries', q.deliveries,
      'commissionTotal', q.commission_total, 'cashCollected', q.cash_collected, 'netBalance', q.net_balance
    ) order by q.created_at desc)
    from (select ds.id, ds.driver_id, p.full_name as driver_name, ds.period_from, ds.period_to, ds.status, ds.notes, ds.created_at, ds.paid_at,
      count(dsi.assignment_id) as deliveries,
      coalesce(sum(round((dac.delivery_fee_snapshot * coalesce(dac.commission_percent_override, r.commission_percent) / 100.0)::numeric, 2)), 0) as commission_total,
      coalesce(sum(private.delivery_cash_due(o.id)), 0) as cash_collected,
      coalesce(sum(round((dac.delivery_fee_snapshot * coalesce(dac.commission_percent_override, r.commission_percent) / 100.0)::numeric, 2) - private.delivery_cash_due(o.id)), 0) as net_balance
      from public.delivery_settlements ds join public.profiles p on p.id = ds.driver_id
      left join public.delivery_settlement_items dsi on dsi.settlement_id = ds.id left join public.delivery_assignments da on da.id = dsi.assignment_id
      left join public.delivery_assignment_compensation dac on dac.assignment_id = da.id left join public.delivery_driver_rates r on r.id = da.rate_id
      left join public.orders o on o.id = da.order_id group by ds.id, p.full_name order by ds.created_at desc limit 50) q), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$



-- Refreshed get_delivery_driver_dashboard from production definition; cash computed using the plan.
CREATE OR REPLACE FUNCTION public.get_delivery_driver_dashboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
declare
  driver uuid := private.current_delivery_driver_id();
  result jsonb;
begin
  if driver is null then raise exception 'No autorizado.' using errcode='42501'; end if;
  select jsonb_build_object(
    'driver', (select jsonb_build_object('id',d.profile_id,'fullName',p.full_name,'email',u.email,'phone',p.phone,'vehicleType',d.vehicle_type,'commissionPercent',r.commission_percent)
      from public.delivery_drivers d join public.profiles p on p.id=d.profile_id left join auth.users u on u.id=d.profile_id
      left join lateral (select commission_percent from public.delivery_driver_rates where driver_id=d.profile_id and valid_to is null order by valid_from desc limit 1) r on true
      where d.profile_id=driver),
    'summary', jsonb_build_object(
      'activeAssignments',(select count(*) from public.delivery_assignments da join public.delivery_driver_rates r on r.id=da.rate_id where r.driver_id=driver and da.status in ('assigned','accepted','picked_up','in_transit')),
      'todayCommission',coalesce((select sum(round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2)) from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id=da.id join public.delivery_driver_rates r on r.id=da.rate_id where r.driver_id=driver and da.status='delivered' and da.delivered_at>=date_trunc('day',timezone('utc',now()))),0),
      'monthCommission',coalesce((select sum(round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2)) from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id=da.id join public.delivery_driver_rates r on r.id=da.rate_id where r.driver_id=driver and da.status='delivered' and da.delivered_at>=date_trunc('month',timezone('utc',now()))),0),
      'pendingCommission',coalesce((select sum(round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2)) from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id=da.id join public.delivery_driver_rates r on r.id=da.rate_id where r.driver_id=driver and da.status='delivered' and not exists(select 1 from public.delivery_settlement_items i join public.delivery_settlements s on s.id=i.settlement_id where i.assignment_id=da.id and s.status='paid')),0),
      'cashPending',coalesce((select sum(private.delivery_cash_due(o.id)) from public.delivery_assignments da join public.delivery_driver_rates r on r.id=da.rate_id join public.orders o on o.id=da.order_id where r.driver_id=driver and da.status='delivered' and not exists(select 1 from public.delivery_settlement_items i join public.delivery_settlements s on s.id=i.settlement_id where i.assignment_id=da.id and s.status='paid')),0)
    ),
    'activeAssignments',coalesce((select jsonb_agg(jsonb_build_object('id',da.id,'orderId',da.order_id,'orderCode',o.order_code,'customerName',o.customer_name,'customerPhone',o.customer_phone,'address',o.address,'mapsUrl',o.delivery_maps_url,'distanceKm',o.delivery_distance_km,'orderTotal',o.total,'paymentMethod',o.payment_method,'notes',o.notes,'status',da.status,'deliveryFee',dac.delivery_fee_snapshot,'commissionPercent',coalesce(dac.commission_percent_override,r.commission_percent),'commissionAmount',round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2),'cashToCollect',private.delivery_cash_due(o.id),'assignedAt',da.assigned_at) order by da.assigned_at) from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id=da.id join public.delivery_driver_rates r on r.id=da.rate_id join public.orders o on o.id=da.order_id where r.driver_id=driver and da.status in ('assigned','accepted','picked_up','in_transit')),'[]'::jsonb),
    'recentDeliveries',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'orderCode',x.order_code,'customerName',x.customer_name,'commissionAmount',x.commission_amount,'cashToCollect',x.cash_to_collect,'deliveredAt',x.delivered_at) order by x.delivered_at desc) from (select da.id,o.order_code,o.customer_name,round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2) commission_amount,private.delivery_cash_due(o.id) cash_to_collect,da.delivered_at from public.delivery_assignments da join public.delivery_assignment_compensation dac on dac.assignment_id=da.id join public.delivery_driver_rates r on r.id=da.rate_id join public.orders o on o.id=da.order_id where r.driver_id=driver and da.status='delivered' order by da.delivered_at desc limit 20)x),'[]'::jsonb),
    'settlements',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'periodFrom',x.period_from,'periodTo',x.period_to,'status',x.status,'createdAt',x.created_at,'paidAt',x.paid_at,'deliveries',x.deliveries,'commissionTotal',x.commission_total,'cashCollected',x.cash_collected,'netBalance',x.net_balance) order by x.created_at desc) from (select s.id,s.period_from,s.period_to,s.status,s.created_at,s.paid_at,count(i.assignment_id) deliveries,coalesce(sum(round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2)),0) commission_total,coalesce(sum(private.delivery_cash_due(o.id)),0) cash_collected,coalesce(sum(round(dac.delivery_fee_snapshot*coalesce(dac.commission_percent_override,r.commission_percent)/100.0,2)-private.delivery_cash_due(o.id)),0) net_balance from public.delivery_settlements s left join public.delivery_settlement_items i on i.settlement_id=s.id left join public.delivery_assignments da on da.id=i.assignment_id left join public.delivery_assignment_compensation dac on dac.assignment_id=da.id left join public.delivery_driver_rates r on r.id=da.rate_id left join public.orders o on o.id=da.order_id where s.driver_id=driver group by s.id order by s.created_at desc limit 20)x),'[]'::jsonb)
  ) into result;
  return result;
end; $function$



-- Refreshed get_delivery_driver_delivery_detail from production definition; cash computed using the plan.
CREATE OR REPLACE FUNCTION public.get_delivery_driver_delivery_detail(assignment_uuid uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
declare
  driver uuid := private.current_delivery_driver_id();
  result jsonb;
begin
  if driver is null then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'id', da.id,
    'orderId', da.order_id,
    'orderCode', o.order_code,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone,
    'address', o.address,
    'mapsUrl', o.delivery_maps_url,
    'distanceKm', o.delivery_distance_km,
    'subtotal', o.subtotal,
    'orderTotal', o.total,
    'deliveryFee', dac.delivery_fee_snapshot,
    'paymentMethod', o.payment_method,
    'cashToCollect', private.delivery_cash_due(o.id),
    'commissionPercent', coalesce(dac.commission_percent_override, r.commission_percent),
    'commissionAmount', round((dac.delivery_fee_snapshot * coalesce(dac.commission_percent_override, r.commission_percent) / 100.0)::numeric, 2),
    'notes', o.notes,
    'status', da.status,
    'assignedAt', da.assigned_at,
    'acceptedAt', da.accepted_at,
    'pickedUpAt', da.picked_up_at,
    'inTransitAt', da.in_transit_at,
    'deliveredAt', da.delivered_at
  ) into result
  from public.delivery_assignments da
  join public.delivery_assignment_compensation dac on dac.assignment_id = da.id
  join public.delivery_driver_rates r on r.id = da.rate_id
  join public.orders o on o.id = da.order_id
  where da.id = assignment_uuid and r.driver_id = driver and da.status = 'delivered';
  if result is null then raise exception 'Entrega finalizada no encontrada.' using errcode = 'P0001'; end if;
  return result;
end;
$function$



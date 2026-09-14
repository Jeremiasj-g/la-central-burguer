create or replace function public.get_delivery_driver_delivery_detail(assignment_uuid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public', 'private'
as $function$
declare
  driver uuid := private.current_delivery_driver_id();
  result jsonb;
begin
  if driver is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

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
    'cashToCollect', case when o.payment_method = 'efectivo' then o.total else 0 end,
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
  where da.id = assignment_uuid
    and r.driver_id = driver
    and da.status = 'delivered';

  if result is null then
    raise exception 'Entrega finalizada no encontrada.' using errcode = 'P0001';
  end if;

  return result;
end;
$function$;

revoke all on function public.get_delivery_driver_delivery_detail(uuid) from public, anon;
grant execute on function public.get_delivery_driver_delivery_detail(uuid) to authenticated;

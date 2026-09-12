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
        'trend', (select count(*) from today_orders)::text || ' pedidos',
        'productRevenue', coalesce((select sum(subtotal) from today_orders), 0),
        'deliveryRevenue', coalesce((select sum(delivery_cost) from today_orders), 0)
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

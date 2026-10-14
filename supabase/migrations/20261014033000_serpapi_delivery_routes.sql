-- Delivery por ruta real usando SerpApi/Google Maps.
-- Migración aditiva: mantiene create_public_order legacy para no romper main durante la prueba de rama.

alter table public.orders
  add column if not exists delivery_route_distance_km numeric(8,3)
    check (delivery_route_distance_km is null or delivery_route_distance_km >= 0),
  add column if not exists delivery_straight_distance_km numeric(8,3)
    check (delivery_straight_distance_km is null or delivery_straight_distance_km >= 0),
  add column if not exists delivery_route_duration_seconds integer
    check (delivery_route_duration_seconds is null or delivery_route_duration_seconds >= 0),
  add column if not exists delivery_route_provider text,
  add column if not exists delivery_travel_mode text,
  add column if not exists delivery_route_via text,
  add column if not exists delivery_route_quoted_at timestamptz;

create or replace function private.get_order_json_route(target_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'orderCode', o.order_code,
    'customerId', o.customer_id,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone,
    'customerEmail', o.customer_email,
    'deliveryMethod', o.delivery_method,
    'address', o.address,
    'customerLat', o.customer_latitude,
    'customerLng', o.customer_longitude,
    'deliveryDistanceKm', o.delivery_distance_km,
    'deliveryRouteDistanceKm', o.delivery_route_distance_km,
    'deliveryStraightDistanceKm', o.delivery_straight_distance_km,
    'deliveryRouteDurationSeconds', o.delivery_route_duration_seconds,
    'deliveryRouteProvider', o.delivery_route_provider,
    'deliveryTravelMode', o.delivery_travel_mode,
    'deliveryRouteVia', o.delivery_route_via,
    'deliveryRouteQuotedAt', o.delivery_route_quoted_at,
    'deliveryMapsUrl', o.delivery_maps_url,
    'paymentMethod', o.payment_method,
    'subtotal', o.subtotal,
    'deliveryCost', o.delivery_cost,
    'total', o.total,
    'status', o.status,
    'notes', o.notes,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'productName', oi.product_name,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price,
        'total', oi.total,
        'note', oi.note
      ) order by oi.created_at)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', osh.status,
        'date', osh.created_at,
        'description', osh.description
      ) order by osh.created_at)
      from public.order_status_history osh
      where osh.order_id = o.id
    ), '[]'::jsonb),
    'createdAt', o.created_at,
    'updatedAt', o.updated_at
  )
  from public.orders o
  where o.id = target_order_id;
$$;

revoke all on function private.get_order_json_route(uuid) from public, anon, authenticated;

create or replace function public.create_public_order_from_route(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  customer_name text := left(btrim(coalesce(payload ->> 'customerName', '')), 120);
  customer_phone text := left(btrim(coalesce(payload ->> 'customerPhone', '')), 40);
  normalized_customer_phone text;
  chosen_delivery public.delivery_method;
  chosen_payment public.payment_method_code;
  latitude numeric;
  longitude numeric;
  route_quote jsonb := payload -> 'serverDeliveryQuote';
  route_distance numeric;
  straight_distance numeric;
  route_duration_seconds integer;
  quoted_delivery_cost numeric := 0;
  maps_url text;
  route_provider text;
  travel_mode text;
  route_via text;
  route_quoted_at timestamptz;
  expected_delivery_cost numeric := 0;
  config public.business_config%rowtype;
  customer_record_id uuid;
  new_order_id uuid;
  new_order_code text;
  calculated_subtotal numeric := 0;
  requested_item jsonb;
  requested_product public.products%rowtype;
  requested_quantity integer;
  requested_note text;
  item_count integer := 0;
begin
  if not public.is_business_open() then
    raise exception 'El local está cerrado. Intentá nuevamente dentro del horario de atención.' using errcode = 'P0001';
  end if;

  if customer_name = '' then
    raise exception 'El nombre del cliente es obligatorio.' using errcode = '22023';
  end if;
  if customer_phone = '' then
    raise exception 'El teléfono del cliente es obligatorio.' using errcode = '22023';
  end if;

  normalized_customer_phone := regexp_replace(customer_phone, '[^0-9]', '', 'g');
  if length(normalized_customer_phone) < 6 then
    raise exception 'El teléfono ingresado no es válido.' using errcode = '22023';
  end if;

  begin
    chosen_delivery := (payload ->> 'deliveryMethod')::public.delivery_method;
    chosen_payment := (payload ->> 'paymentMethod')::public.payment_method_code;
  exception when others then
    raise exception 'Método de entrega o de pago inválido.' using errcode = '22023';
  end;

  if not exists (
    select 1
    from public.payment_methods pm
    where pm.code = chosen_payment
      and pm.active = true
  ) then
    raise exception 'El método de pago seleccionado no está disponible.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(payload -> 'items') <> 'array'
    or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'El pedido no contiene productos.' using errcode = '22023';
  end if;

  if jsonb_array_length(payload -> 'items') > 50 then
    raise exception 'El pedido contiene demasiadas líneas de productos.' using errcode = '22023';
  end if;

  perform p.id
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.id::text in (
    select item ->> 'productId'
    from jsonb_array_elements(payload -> 'items') item
  )
  order by p.id
  for share of p, c;

  if chosen_delivery = 'delivery' then
    latitude := nullif(payload ->> 'customerLat', '')::numeric;
    longitude := nullif(payload ->> 'customerLng', '')::numeric;

    if latitude is null or longitude is null
      or latitude not between -90 and 90
      or longitude not between -180 and 180 then
      raise exception 'Para solicitar delivery, compartí una ubicación GPS válida.' using errcode = '22023';
    end if;

    if route_quote is null or jsonb_typeof(route_quote) <> 'object' then
      raise exception 'Falta la cotización validada de la ruta.' using errcode = '22023';
    end if;

    route_distance := nullif(route_quote ->> 'routeDistanceKm', '')::numeric;
    straight_distance := nullif(route_quote ->> 'straightDistanceKm', '')::numeric;
    route_duration_seconds := nullif(route_quote ->> 'routeDurationSeconds', '')::integer;
    quoted_delivery_cost := nullif(route_quote ->> 'deliveryCost', '')::numeric;
    route_provider := left(btrim(coalesce(route_quote ->> 'routeProvider', '')), 80);
    travel_mode := left(btrim(coalesce(route_quote ->> 'travelMode', '')), 40);
    route_via := nullif(left(btrim(coalesce(route_quote ->> 'routeVia', '')), 240), '');
    route_quoted_at := nullif(route_quote ->> 'quotedAt', '')::timestamptz;

    if route_distance is null or route_distance < 0
      or straight_distance is null or straight_distance < 0
      or quoted_delivery_cost is null or quoted_delivery_cost < 0 then
      raise exception 'La cotización de delivery no contiene distancias o precio válidos.' using errcode = '22023';
    end if;

    if route_duration_seconds is not null and route_duration_seconds < 0 then
      raise exception 'La duración de la ruta no es válida.' using errcode = '22023';
    end if;

    if route_provider <> 'serpapi_google_maps' or travel_mode <> 'two_wheeler' then
      raise exception 'El proveedor o modo de ruta no es válido.' using errcode = '22023';
    end if;

    if route_quoted_at is null
      or route_quoted_at < timezone('utc', now()) - interval '30 minutes'
      or route_quoted_at > timezone('utc', now()) + interval '2 minutes' then
      raise exception 'La cotización de delivery venció. Volvé a calcular el envío.' using errcode = '22023';
    end if;

    select *
      into config
    from public.business_config
    where id = 1;

    if not found
      or config.store_latitude is null
      or config.store_longitude is null then
      raise exception 'La ubicación del local no está configurada.' using errcode = 'P0001';
    end if;

    if config.delivery_max_distance_km > 0
      and route_distance > config.delivery_max_distance_km then
      raise exception 'Tu ubicación está fuera del radio de entrega. Podés elegir retiro en el local.' using errcode = '22023';
    end if;

    expected_delivery_cost :=
      ceil(
        (config.delivery_base_fee + route_distance * config.delivery_price_per_km)
        / config.delivery_rounding_value
      ) * config.delivery_rounding_value;

    if quoted_delivery_cost is distinct from expected_delivery_cost then
      raise exception 'La tarifa de envío cambió. Volvé a calcular el delivery.' using errcode = '22023';
    end if;

    if nullif(payload ->> 'expectedDeliveryCost', '') is not null
      and (payload ->> 'expectedDeliveryCost')::numeric is distinct from quoted_delivery_cost then
      raise exception 'La tarifa de envío cambió. Volvé a calcular el delivery.' using errcode = '22023';
    end if;

    maps_url := 'https://www.google.com/maps?q=' || latitude::text || ',' || longitude::text;
  else
    latitude := null;
    longitude := null;
    route_distance := null;
    straight_distance := null;
    route_duration_seconds := null;
    quoted_delivery_cost := 0;
    maps_url := null;
    route_provider := null;
    travel_mode := null;
    route_via := null;
    route_quoted_at := null;
  end if;

  insert into public.customers (
    full_name,
    phone,
    normalized_phone,
    email,
    default_address,
    default_latitude,
    default_longitude
  ) values (
    customer_name,
    customer_phone,
    normalized_customer_phone,
    nullif(left(btrim(coalesce(payload ->> 'customerEmail', '')), 160), ''),
    null,
    latitude,
    longitude
  )
  on conflict on constraint customers_normalized_phone_key do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = coalesce(excluded.email, public.customers.email),
    default_latitude = coalesce(excluded.default_latitude, public.customers.default_latitude),
    default_longitude = coalesce(excluded.default_longitude, public.customers.default_longitude),
    updated_at = timezone('utc', now())
  returning id into customer_record_id;

  new_order_code := public.generate_order_code();

  for requested_item in
    select * from jsonb_array_elements(payload -> 'items')
  loop
    requested_quantity := greatest(
      1,
      least(99, coalesce((requested_item ->> 'quantity')::integer, 1))
    );

    select p.*
      into requested_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id::text = requested_item ->> 'productId'
      and p.active = true
      and p.available = true
      and p.deleted_at is null
      and c.active = true
      and c.deleted_at is null;

    if not found then
      raise exception 'Uno de los productos ya no se encuentra disponible.' using errcode = 'P0001';
    end if;

    calculated_subtotal :=
      calculated_subtotal + (requested_product.current_price * requested_quantity);
    item_count := item_count + 1;
  end loop;

  if item_count = 0 then
    raise exception 'El pedido no contiene productos válidos.' using errcode = '22023';
  end if;

  insert into public.orders (
    order_code,
    customer_id,
    customer_name,
    customer_phone,
    customer_email,
    delivery_method,
    address,
    customer_latitude,
    customer_longitude,
    delivery_distance_km,
    delivery_route_distance_km,
    delivery_straight_distance_km,
    delivery_route_duration_seconds,
    delivery_route_provider,
    delivery_travel_mode,
    delivery_route_via,
    delivery_route_quoted_at,
    delivery_maps_url,
    payment_method,
    subtotal,
    delivery_cost,
    status,
    notes,
    source
  ) values (
    new_order_code,
    customer_record_id,
    customer_name,
    customer_phone,
    nullif(left(btrim(coalesce(payload ->> 'customerEmail', '')), 160), ''),
    chosen_delivery,
    null,
    latitude,
    longitude,
    route_distance,
    route_distance,
    straight_distance,
    route_duration_seconds,
    route_provider,
    travel_mode,
    route_via,
    route_quoted_at,
    maps_url,
    chosen_payment,
    calculated_subtotal,
    quoted_delivery_cost,
    'aceptado',
    nullif(left(btrim(coalesce(payload ->> 'notes', '')), 1000), ''),
    'web'
  )
  returning id into new_order_id;

  for requested_item in
    select * from jsonb_array_elements(payload -> 'items')
  loop
    requested_quantity := greatest(
      1,
      least(99, coalesce((requested_item ->> 'quantity')::integer, 1))
    );
    requested_note := nullif(
      left(btrim(coalesce(requested_item ->> 'note', '')), 500),
      ''
    );

    select p.*
      into requested_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id::text = requested_item ->> 'productId'
      and p.active = true
      and p.available = true
      and p.deleted_at is null
      and c.active = true
      and c.deleted_at is null;

    insert into public.order_items (
      order_id,
      product_id,
      category_id,
      product_name,
      category_name,
      image_url,
      is_promotion,
      quantity,
      unit_price,
      note
    )
    select
      new_order_id,
      requested_product.id,
      requested_product.category_id,
      requested_product.name::text,
      c.name::text,
      requested_product.image_url,
      requested_product.is_promotion,
      requested_quantity,
      requested_product.current_price,
      requested_note
    from public.categories c
    where c.id = requested_product.category_id;
  end loop;

  return private.get_order_json_route(new_order_id);
end;
$$;

revoke all on function public.create_public_order_from_route(jsonb)
  from public, anon, authenticated;
grant execute on function public.create_public_order_from_route(jsonb)
  to service_role;

create or replace function public.get_delivery_driver_route_metadata(order_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, auth
as $$
declare
  driver uuid := private.current_delivery_driver_id();
  result jsonb;
begin
  if driver is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'orderId', q.id,
        'routeDistanceKm', q.delivery_route_distance_km,
        'straightDistanceKm', q.delivery_straight_distance_km,
        'routeDurationSeconds', q.delivery_route_duration_seconds,
        'routeProvider', q.delivery_route_provider,
        'travelMode', q.delivery_travel_mode,
        'routeVia', q.delivery_route_via,
        'routeQuotedAt', q.delivery_route_quoted_at
      )
      order by q.created_at desc
    ),
    '[]'::jsonb
  )
  into result
  from (
    select distinct on (o.id)
      o.id,
      o.created_at,
      o.delivery_route_distance_km,
      o.delivery_straight_distance_km,
      o.delivery_route_duration_seconds,
      o.delivery_route_provider,
      o.delivery_travel_mode,
      o.delivery_route_via,
      o.delivery_route_quoted_at
    from public.orders o
    join public.delivery_assignments da on da.order_id = o.id
    join public.delivery_driver_rates r on r.id = da.rate_id
    where o.id = any(order_ids)
      and r.driver_id = driver
    order by o.id, da.assigned_at desc
  ) q;

  return result;
end;
$$;

revoke all on function public.get_delivery_driver_route_metadata(uuid[])
  from public, anon;
grant execute on function public.get_delivery_driver_route_metadata(uuid[])
  to authenticated;

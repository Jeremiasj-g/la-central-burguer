-- Delivery público: GPS obligatorio, cotización server-side definitiva y rechazo fuera de radio.
-- Esta migración refleja la función aplicada en producción el 2026-09-10.

create or replace function public.create_public_order(payload jsonb)
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
  delivery_address text := nullif(left(btrim(coalesce(payload ->> 'address', '')), 300), '');
  latitude numeric;
  longitude numeric;
  distance numeric;
  quoted_delivery_cost numeric := 0;
  maps_url text;
  within_range boolean := false;
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
    select 1 from public.payment_methods pm
    where pm.code = chosen_payment and pm.active = true
  ) then
    raise exception 'El método de pago seleccionado no está disponible.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'El pedido no contiene productos.' using errcode = '22023';
  end if;
  if jsonb_array_length(payload -> 'items') > 50 then
    raise exception 'El pedido contiene demasiadas líneas de productos.' using errcode = '22023';
  end if;

  -- Bloqueamos productos/categorías en orden estable para que precio y disponibilidad
  -- no cambien entre el cálculo del subtotal y la creación de los ítems.
  perform p.id
  from public.products p
  join public.categories c on c.id = p.category_id
  where p.id::text in (
    select item ->> 'productId' from jsonb_array_elements(payload -> 'items') item
  )
  order by p.id
  for share of p, c;

  if chosen_delivery = 'delivery' then
    latitude := nullif(payload ->> 'customerLat', '')::numeric;
    longitude := nullif(payload ->> 'customerLng', '')::numeric;

    if latitude is null or longitude is null
      or latitude not between -90 and 90 or longitude not between -180 and 180 then
      raise exception 'Para solicitar delivery, compartí una ubicación GPS válida.' using errcode = '22023';
    end if;

    delivery_address := null;

    select q.distance_km, q.delivery_cost, q.is_within_range, q.maps_url
      into distance, quoted_delivery_cost, within_range, maps_url
    from public.calculate_delivery_quote(latitude, longitude) q;

    if not found or distance is null or quoted_delivery_cost is null or maps_url is null then
      raise exception 'No se puede calcular el envío. Intentá nuevamente o elegí retiro en el local.' using errcode = '22023';
    end if;

    if within_range is distinct from true then
      raise exception 'Tu ubicación está fuera del radio de entrega. Podés elegir retiro en el local.' using errcode = '22023';
    end if;

    -- El precio real siempre sale del servidor; si el cliente envía la cotización que vio,
    -- también detectamos cambios ocurridos entre cotizar y confirmar el pedido.
    if nullif(payload ->> 'expectedDeliveryCost', '') is not null
      and (payload ->> 'expectedDeliveryCost')::numeric is distinct from quoted_delivery_cost then
      raise exception 'La tarifa de envío cambió. Quitá la ubicación y volvé a adjuntarla para actualizar el total.' using errcode = '22023';
    end if;
  else
    quoted_delivery_cost := 0;
    delivery_address := null;
    latitude := null;
    longitude := null;
    distance := null;
    maps_url := null;
  end if;

  insert into public.customers (
    full_name, phone, normalized_phone, email, default_address, default_latitude, default_longitude
  ) values (
    customer_name,
    customer_phone,
    normalized_customer_phone,
    nullif(left(btrim(coalesce(payload ->> 'customerEmail', '')), 160), ''),
    delivery_address,
    latitude,
    longitude
  )
  on conflict on constraint customers_normalized_phone_key do update set
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = coalesce(excluded.email, public.customers.email),
    default_address = coalesce(excluded.default_address, public.customers.default_address),
    default_latitude = coalesce(excluded.default_latitude, public.customers.default_latitude),
    default_longitude = coalesce(excluded.default_longitude, public.customers.default_longitude),
    updated_at = timezone('utc', now())
  returning id into customer_record_id;

  new_order_code := public.generate_order_code();

  -- Calculamos subtotal con precios reales de la base, no con el valor enviado por el navegador.
  for requested_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    requested_quantity := greatest(1, least(99, coalesce((requested_item ->> 'quantity')::integer, 1)));
    select p.* into requested_product
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

    calculated_subtotal := calculated_subtotal + (requested_product.current_price * requested_quantity);
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
    delivery_address,
    latitude,
    longitude,
    distance,
    maps_url,
    chosen_payment,
    calculated_subtotal,
    quoted_delivery_cost,
    'aceptado',
    nullif(left(btrim(coalesce(payload ->> 'notes', '')), 1000), ''),
    'web'
  ) returning id into new_order_id;

  for requested_item in select * from jsonb_array_elements(payload -> 'items')
  loop
    requested_quantity := greatest(1, least(99, coalesce((requested_item ->> 'quantity')::integer, 1)));
    requested_note := nullif(left(btrim(coalesce(requested_item ->> 'note', '')), 500), '');

    select p.* into requested_product
    from public.products p
    join public.categories c on c.id = p.category_id
    where p.id::text = requested_item ->> 'productId'
      and p.active = true
      and p.available = true
      and p.deleted_at is null
      and c.active = true
      and c.deleted_at is null;

    insert into public.order_items (
      order_id, product_id, category_id, product_name, category_name, image_url,
      is_promotion, quantity, unit_price, note
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

  return private.get_order_json(new_order_id);
end;
$$;

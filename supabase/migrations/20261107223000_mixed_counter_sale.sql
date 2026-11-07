-- Mixed counter sale: one transactional sale and two audited confirmed receipts.
create table if not exists public.counter_mixed_sale_requests (
  request_key uuid primary key,
  order_id uuid unique references public.orders(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.counter_mixed_sale_requests enable row level security;
revoke all on public.counter_mixed_sale_requests from public,anon,authenticated;

create or replace function public.admin_create_mixed_counter_sale(payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $sale$
declare
  actor uuid := auth.uid();
  request_id uuid;
  prior_order uuid;
  payment_transfer numeric(12,2);
  payment_cash numeric(12,2);
  price numeric(12,2);
  subtotal_value numeric(12,2) := 0;
  final_total numeric(12,2);
  row_item jsonb;
  item_product public.products%rowtype;
  item_category public.categories%rowtype;
  line_qty integer;
  new_order uuid;
  code text;
  name_value text;
  phone_value text;
  service_mode text;
  sale_notes text;
  seen uuid[] := array[]::uuid[];
begin
  if actor is null or not private.is_admin() then
    raise exception 'No tenés permisos para registrar ventas.' using errcode='42501';
  end if;
  if jsonb_typeof(payload) <> 'object' or (payload->>'requestKey') is null then
    raise exception 'Solicitud inválida.' using errcode='22023';
  end if;
  request_id := (payload->>'requestKey')::uuid;
  insert into public.counter_mixed_sale_requests(request_key) values(request_id)
  on conflict do nothing;
  if not found then
    select order_id into prior_order from public.counter_mixed_sale_requests where request_key=request_id;
    if prior_order is null then raise exception 'La venta todavía se está confirmando.' using errcode='40001'; end if;
    select o.order_code,o.total into code,final_total from public.orders o where o.id=prior_order;
    return jsonb_build_object('orderId',prior_order,'orderCode',code,'total',final_total,'repeated',true);
  end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') not between 1 and 50 then
    raise exception 'Ingresá entre 1 y 50 productos.' using errcode='22023';
  end if;
  if jsonb_typeof(payload->'transferAmount') <> 'number' then
    raise exception 'Indicá el importe de transferencia.' using errcode='22023';
  end if;
  payment_transfer := (payload->>'transferAmount')::numeric;
  if payment_transfer <= 0 or payment_transfer > 9999999999.99
     or payment_transfer <> round(payment_transfer,2) then
    raise exception 'El importe de transferencia no es válido.' using errcode='22023';
  end if;
  if not exists(select 1 from public.payment_methods pm where pm.code='efectivo' and pm.active)
     or not exists(select 1 from public.payment_methods pm where pm.code='transferencia' and pm.active) then
    raise exception 'Los métodos de pago no están habilitados.' using errcode='22023';
  end if;
  name_value := left(coalesce(nullif(btrim(payload->>'customerName'),''),'Venta mostrador'),120);
  phone_value := left(coalesce(nullif(btrim(payload->>'customerPhone'),''),'Sin teléfono'),40);
  if phone_value <> 'Sin teléfono' and length(regexp_replace(phone_value,'[^0-9]','','g')) < 6 then
    raise exception 'El teléfono no es válido.' using errcode='22023';
  end if;
  service_mode := payload->>'serviceMode';
  if service_mode not in ('takeaway','dine_in') or service_mode is null then
    raise exception 'Modalidad de venta inválida.' using errcode='22023';
  end if;
  sale_notes := 'Venta mostrador · ' ||
    case when service_mode='dine_in' then 'Comer en el local.' else 'Para llevar.' end ||
    case when nullif(btrim(coalesce(payload->>'notes','')),'') is not null
      then E'\n' || left(btrim(payload->>'notes'),950) else '' end;
  -- Lock and derive prices on the server; the browser cannot decide a sale total.
  for row_item in select value from jsonb_array_elements(payload->'items')
  loop
    if jsonb_typeof(row_item)<>'object' or (row_item->>'quantity') !~ '^[0-9]{1,2}$' then
      raise exception 'La cantidad de productos no es válida.' using errcode='22023';
    end if;
    line_qty := (row_item->>'quantity')::int;
    if line_qty not between 1 and 99 then raise exception 'La cantidad supera el máximo.' using errcode='22023'; end if;
    if row_item->>'productId' is null then raise exception 'Falta un producto.' using errcode='22023'; end if;
    select p.* into item_product
      from public.products p join public.categories c on c.id=p.category_id
      where p.id=(row_item->>'productId')::uuid and p.active and p.available
        and p.deleted_at is null and c.active and c.deleted_at is null
      for share of p,c;
    if not found then raise exception 'Uno de los productos ya no está disponible.' using errcode='22023'; end if;
    select c.* into item_category from public.categories c where c.id=item_product.category_id;
    if item_product.id=any(seen) then raise exception 'No repitas el mismo producto.' using errcode='22023'; end if;
    seen := array_append(seen,item_product.id);
    price := public.discounted_product_price(item_product.id,item_product.category_id,item_product.current_price);
    subtotal_value := subtotal_value + price * line_qty;
  end loop;
  if subtotal_value <= 0 then raise exception 'El total de la venta debe ser positivo.' using errcode='22023'; end if;
  code := public.generate_order_code();
  insert into public.orders(order_code,customer_name,customer_phone,delivery_method,
    payment_method,payment_preference,subtotal,delivery_cost,status,notes,source)
  values(code,name_value,phone_value,'retiro_local','efectivo','combinado',
    subtotal_value,0,'entregado',sale_notes,'admin') returning id into new_order;
  for row_item in select value from jsonb_array_elements(payload->'items')
  loop
    line_qty := (row_item->>'quantity')::int;
    select p.* into item_product from public.products p
      where p.id=(row_item->>'productId')::uuid for share;
    select c.* into item_category from public.categories c where c.id=item_product.category_id;
    price := public.discounted_product_price(item_product.id,item_product.category_id,item_product.current_price);
    insert into public.order_items(order_id,product_id,category_id,product_name,category_name,image_url,
      is_promotion,quantity,unit_price)
    values(new_order,item_product.id,item_product.category_id,item_product.name::text,
      item_category.name::text,item_product.image_url,item_product.is_promotion,line_qty,price);
  end loop;
  select o.total into final_total from public.orders o where o.id=new_order for update;
  if final_total <> subtotal_value or payment_transfer >= final_total then
    raise exception 'El importe de transferencia debe ser menor que el total final de la venta.' using errcode='22023';
  end if;
  payment_cash := final_total-payment_transfer;
  insert into public.order_payment_plans(order_id,transfer_amount,cash_amount,updated_by)
  values(new_order,payment_transfer,payment_cash,actor);
  insert into public.order_payment_movements(order_id,method,amount,kind,source,idempotency_key,confirmed_by)
  values(new_order,'transferencia',payment_transfer,'payment','counter',gen_random_uuid(),actor),
        (new_order,'efectivo',payment_cash,'payment','counter',gen_random_uuid(),actor);
  update public.counter_mixed_sale_requests set order_id=new_order where request_key=request_id;
  return jsonb_build_object('orderId',new_order,'orderCode',code,'total',final_total,'repeated',false);
end $sale$;
revoke all on function public.admin_create_mixed_counter_sale(jsonb) from public,anon;
grant execute on function public.admin_create_mixed_counter_sale(jsonb) to authenticated;

create or replace function public.my_customer_orders()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account_uuid uuid := auth.uid();
begin
 if account_uuid is null then raise exception 'Iniciá sesión para consultar tus pedidos'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',o.id,'code',o.order_code,'createdAt',o.created_at,
   'status',o.status,'total',o.total,'deliveryMethod',o.delivery_method,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'name',oi.product_name,'quantity',oi.quantity,'price',oi.unit_price))
       from public.order_items oi where oi.order_id=o.id),'[]'::jsonb))
  order by o.created_at desc)
  from public.customer_order_links link
  join public.orders o on o.id=link.order_id
  where link.user_id=account_uuid
 ),'[]'::jsonb);
end $$;

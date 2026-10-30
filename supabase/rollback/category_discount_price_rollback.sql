-- Recuperación manual: restaura el cálculo original de las dos RPC de pedidos.
-- No elimina campañas ni datos; únicamente desactiva su efecto en el cobro.
do $recovery$
declare
  function_name text;
  definition text;
begin
  foreach function_name in array array['create_public_order', 'create_public_order_from_route'] loop
    select pg_get_functiondef(p.oid) into definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = function_name
      and pg_get_function_identity_arguments(p.oid) = 'payload jsonb';
    if definition is null then raise exception 'No existe %', function_name; end if;
    definition := replace(definition,
      'public.discounted_product_price(requested_product.category_id, requested_product.current_price) * requested_quantity',
      'requested_product.current_price * requested_quantity');
    definition := replace(definition,
      'public.discounted_product_price(requested_product.category_id, requested_product.current_price),',
      'requested_product.current_price,');
    definition := replace(definition,
      '(requested_product.is_promotion OR public.get_category_discount_percent(requested_product.category_id) > 0),',
      'requested_product.is_promotion,');
    execute definition;
  end loop;
end;
$recovery$;
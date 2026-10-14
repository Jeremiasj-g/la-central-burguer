-- Expone explícitamente el método de entrega en los pedidos sin asignar del dashboard
-- para permitir una segunda capa de filtrado defensivo en el frontend.
do $$
declare
  ddl text;
begin
  select pg_get_functiondef(p.oid)
  into ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_delivery_admin_dashboard'
  limit 1;

  if ddl is null then
    raise exception 'No se encontró public.get_delivery_admin_dashboard()';
  end if;

  ddl := replace(
    ddl,
    '''id'', o.id, ''orderCode'', o.order_code',
    '''id'', o.id, ''deliveryMethod'', o.delivery_method, ''orderCode'', o.order_code'
  );

  execute ddl;
end $$;

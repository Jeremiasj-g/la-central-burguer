-- EXCLUSIVO DE SUPABASE CENTRAL-BURGUER-DEV.
-- NO mover a supabase/migrations ni ejecutar en producción.
-- Se aplica una sola vez cuando se reconstruye desde cero la base QA.
-- Permite guardar cotizaciones firmadas por el servidor Next.js que utilizan
-- el proveedor 'dev_simulated' para la prueba de pedidos SIN SerpApi.
-- En producción el proveedor sigue limitado a 'serpapi_google_maps'.

do $devqa$
declare
  fn_sql text;
  target text := 'if route_provider <> ''serpapi_google_maps'' or travel_mode <> ''two_wheeler'' then';
  replacement text := 'if route_provider not in (''serpapi_google_maps'', ''dev_simulated'') or travel_mode <> ''two_wheeler'' then';
begin
  if not exists (
    select 1 from public.business_config
    where id=1 and (
      business_name ilike '%pruebas%'
      or business_name ilike '%dev%'
      or business_name ilike '%demo%'
    )
  ) then
    raise exception 'Esta migración es EXCLUSIVA del entorno DEV.';
  end if;

  fn_sql := pg_get_functiondef('public.create_public_order_from_route(jsonb)'::regprocedure);

  if fn_sql like '%' || replacement || '%' then
    raise notice 'Las cotizaciones simuladas ya están habilitadas en DEV.';
    return;
  end if;

  if fn_sql not like '%' || target || '%' then
    raise exception 'La validación de rutas fue modificada. Revisá la función antes de actualizarla.';
  end if;

  execute replace(fn_sql, target, replacement);
end
$devqa$;

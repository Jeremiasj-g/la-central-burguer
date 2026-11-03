-- EXCLUSIVO DE SUPABASE "chetos-dev": habilita el proveedor de distancia
-- directa por GPS/Haversine para cotizaciones firmadas por Next.js en DEV.
-- No ejecutar en La Central Burger de producción ni agregar a migraciones comunes.
DO $chet_dev_only$
DECLARE
  fn_sql text;
  original_clause text := 'if route_provider <> ''serpapi_google_maps'' or travel_mode <> ''two_wheeler'' then';
  new_clause text := 'if route_provider not in (''serpapi_google_maps'', ''haversine_gps'') or travel_mode <> ''two_wheeler'' then';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.business_config WHERE id = 1 AND business_name = 'Chetos') THEN
    RAISE EXCEPTION 'Operación permitida solamente para la base Chetos DEV.';
  END IF;

  fn_sql := pg_get_functiondef('public.create_public_order_from_route(jsonb)'::regprocedure);
  IF strpos(fn_sql, new_clause) > 0 THEN
    RAISE NOTICE 'El proveedor haversine_gps ya está habilitado.';
    RETURN;
  END IF;
  IF strpos(fn_sql, original_clause) = 0 THEN
    RAISE EXCEPTION 'La validación de proveedores cambió; revisar antes de modificar.';
  END IF;

  EXECUTE replace(fn_sql, original_clause, new_clause);
END
$chet_dev_only$;

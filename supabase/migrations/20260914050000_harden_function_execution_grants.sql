-- Hardening de EXECUTE para funciones SECURITY DEFINER.
--
-- Las funciones públicas de cotización/pedido (`calculate_delivery_quote`,
-- `create_public_order`, `is_business_open`) conservan acceso anónimo porque
-- forman parte del flujo público del cliente.
--
-- Las RPC administrativas conservan acceso a `authenticated` porque validan
-- RBAC internamente mediante `private.is_admin()` / helpers equivalentes.

-- Funciones de trigger: nunca deben ser invocables directamente vía Data API.
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.customers_refresh_order_stats() from public, anon, authenticated;
revoke all on function public.orders_write_status_history() from public, anon, authenticated;

-- Dashboard administrativo: sólo usuarios autenticados; la función valida admin.
revoke all on function public.get_dashboard_stats(integer) from public, anon;
grant execute on function public.get_dashboard_stats(integer) to authenticated;

-- Sincronización de recetas/ingredientes: sólo usuarios autenticados; valida admin.
revoke all on function public.sync_product_ingredients(uuid, jsonb) from public, anon;
grant execute on function public.sync_product_ingredients(uuid, jsonb) to authenticated;

-- La Central Burger / main: los pedidos de reparto solo se asignan
-- en su fecha de creación según la zona horaria del negocio.
-- Conserva intactas todas las asignaciones y liquidaciones históricas.
DO $lcb_delivery_scope$
BEGIN
  IF (SELECT business_name FROM public.business_config WHERE id = 1) IS DISTINCT FROM 'La Central Burger' THEN
    RAISE EXCEPTION 'Esta regla corresponde únicamente a La Central Burger.';
  END IF;
END
$lcb_delivery_scope$;

CREATE OR REPLACE FUNCTION public.restrict_delivery_assignment_to_order_day()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  created_on timestamptz;
  business_tz text;
BEGIN
  SELECT o.created_at INTO created_on
  FROM public.orders o
  WHERE o.id = NEW.order_id;

  SELECT NULLIF(b.timezone, '') INTO business_tz
  FROM public.business_config b WHERE b.id = 1;
  business_tz := COALESCE(business_tz, 'America/Argentina/Cordoba');

  IF created_on IS NOT NULL
     AND (created_on AT TIME ZONE business_tz)::date
       IS DISTINCT FROM (now() AT TIME ZONE business_tz)::date THEN
    RAISE EXCEPTION 'Solo se pueden asignar pedidos creados hoy. Los pedidos anteriores quedan para consulta.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.restrict_delivery_assignment_to_order_day() FROM PUBLIC;

DROP TRIGGER IF EXISTS restrict_delivery_assignment_to_order_day
  ON public.delivery_assignments;
CREATE TRIGGER restrict_delivery_assignment_to_order_day
BEFORE INSERT ON public.delivery_assignments
FOR EACH ROW
EXECUTE FUNCTION public.restrict_delivery_assignment_to_order_day();

-- Detalle de efectivo pendiente: accesible solo para administradores
-- autenticados, sin exponer teléfonos, direcciones ni datos de clientes.
CREATE OR REPLACE FUNCTION public.admin_delivery_cash_pending_details()
RETURNS TABLE(
  "orderCode" text,
  "deliveredAt" timestamptz,
  "driverName" text,
  "cashAmount" numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      o.order_code::text,
      da.delivered_at,
      p.full_name::text,
      o.total::numeric
    FROM public.delivery_assignments da
    JOIN public.orders o ON o.id = da.order_id
    JOIN public.delivery_driver_rates r ON r.id = da.rate_id
    JOIN public.profiles p ON p.id = r.driver_id
    WHERE da.status = 'delivered'
      AND o.payment_method = 'efectivo'
      AND NOT EXISTS (
        SELECT 1
        FROM public.delivery_settlement_items dsi
        JOIN public.delivery_settlements ds ON ds.id = dsi.settlement_id
        WHERE dsi.assignment_id = da.id AND ds.status = 'paid'
      )
    ORDER BY da.delivered_at DESC, da.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delivery_cash_pending_details() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delivery_cash_pending_details() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delivery_cash_pending_details() TO authenticated;
COMMENT ON FUNCTION public.admin_delivery_cash_pending_details() IS
  'Detalle de pedidos entregados en efectivo sin liquidación pagada; solo admin.';
NOTIFY pgrst, 'reload schema';

-- La Central Burger: ranking público agregado de los tres platos más vendidos
-- del mes calendario vigente en la zona horaria configurada del negocio.
-- No revela pedidos, información de clientes ni montos de facturación.
CREATE OR REPLACE FUNCTION public.get_public_best_sellers()
RETURNS TABLE(product_id uuid, units_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH business_period AS (
    SELECT date_trunc(
      'month',
      now() AT TIME ZONE coalesce(
        (SELECT nullif(b.timezone, '') FROM public.business_config b WHERE b.id = 1),
        'America/Argentina/Buenos_Aires'
      )
    ) AT TIME ZONE coalesce(
      (SELECT nullif(b.timezone, '') FROM public.business_config b WHERE b.id = 1),
      'America/Argentina/Buenos_Aires'
    ) AS month_start
  )
  SELECT oi.product_id, sum(oi.quantity)::bigint AS units_sold
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.products p ON p.id = oi.product_id
  JOIN public.categories c ON c.id = p.category_id
  CROSS JOIN business_period period
  WHERE o.status <> 'cancelado'::public.order_status
    AND o.created_at >= period.month_start
    AND o.created_at <= now()
    AND p.active IS TRUE
    AND p.deleted_at IS NULL
    AND c.active IS TRUE
    AND c.deleted_at IS NULL
    AND oi.product_id IS NOT NULL
    AND c.name::text !~* '^[[:space:]]*(papas?|extras?|adicional(es)?|gratinados?|guarniciones?|acompa[ñn]amientos?|salsas?)([[:space:]]|$)'
    AND p.name::text !~* '^[[:space:]]*(papas?|extras?|adicional(es)?|gratinados?|guarniciones?|porci[oó]n[[:space:]]+de[[:space:]]+papas?|salsas?)([[:space:]]|$)'
  GROUP BY oi.product_id
  ORDER BY sum(oi.quantity) DESC, oi.product_id ASC
  LIMIT 3
$$;

REVOKE ALL ON FUNCTION public.get_public_best_sellers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_best_sellers() TO anon, authenticated;
COMMENT ON FUNCTION public.get_public_best_sellers() IS
  'Devuelve exclusivamente los 3 IDs de productos activos y sus unidades vendidas del mes actual, excluyendo papas, extras y pedidos cancelados.';

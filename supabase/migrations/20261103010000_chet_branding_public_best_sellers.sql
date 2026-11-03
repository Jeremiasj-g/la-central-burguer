-- Chetos DEV: textos configurables de la portada y estadísticas agregadas públicas.
ALTER TABLE public.business_config
  ADD COLUMN IF NOT EXISTS hero_title_prefix text NOT NULL DEFAULT 'Comida que ',
  ADD COLUMN IF NOT EXISTS hero_title_highlight text NOT NULL DEFAULT 'se disfruta',
  ADD COLUMN IF NOT EXISTS hero_title_suffix text NOT NULL DEFAULT ' de verdad.',
  ADD COLUMN IF NOT EXISTS hero_primary_button_label text NOT NULL DEFAULT 'Ver nuestra carta',
  ADD COLUMN IF NOT EXISTS hero_secondary_button_label text NOT NULL DEFAULT 'Descubrí los más vendidos',
  ADD COLUMN IF NOT EXISTS hero_image_caption text NOT NULL DEFAULT 'Una obra maestra',
  ADD COLUMN IF NOT EXISTS hero_service_label text NOT NULL DEFAULT 'Pedidos online',
  ADD COLUMN IF NOT EXISTS footer_tagline text NOT NULL DEFAULT 'Una obra maestra.',
  ADD COLUMN IF NOT EXISTS footer_description text NOT NULL DEFAULT 'Hamburguesas, lomitos, pizzas y tus comidas favoritas, hechas para disfrutar.',
  ADD COLUMN IF NOT EXISTS footer_links_heading text NOT NULL DEFAULT 'Explorá',
  ADD COLUMN IF NOT EXISTS footer_contact_heading text NOT NULL DEFAULT 'Encontranos',
  ADD COLUMN IF NOT EXISTS footer_home_label text NOT NULL DEFAULT 'Inicio',
  ADD COLUMN IF NOT EXISTS footer_best_sellers_label text NOT NULL DEFAULT 'Más vendidos',
  ADD COLUMN IF NOT EXISTS footer_menu_label text NOT NULL DEFAULT 'Carta y pedidos',
  ADD COLUMN IF NOT EXISTS footer_credit text NOT NULL DEFAULT 'Desarrollado por @Devcor',
  ADD COLUMN IF NOT EXISTS footer_copyright text NOT NULL DEFAULT 'Todos los derechos reservados.';

COMMENT ON COLUMN public.business_config.hero_title_highlight IS 'Segmento del título resaltado en naranja en la portada pública';
COMMENT ON COLUMN public.business_config.footer_credit IS 'Crédito de pie de página configurable desde el panel';

-- Solo entrega IDs y unidades acumuladas; jamás expone clientes, tickets ni importes.
-- Usa el mismo criterio de ventas que el dashboard: pedidos no cancelados.
CREATE OR REPLACE FUNCTION public.get_public_best_sellers()
RETURNS TABLE(product_id uuid, units_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT oi.product_id, SUM(oi.quantity)::bigint AS units_sold
  FROM public.order_items AS oi
  INNER JOIN public.orders AS o ON o.id = oi.order_id
  INNER JOIN public.products AS p ON p.id = oi.product_id
  INNER JOIN public.categories AS c ON c.id = p.category_id
  WHERE o.status <> 'cancelado'::public.order_status
    AND p.active IS TRUE
    AND p.available IS TRUE
    AND p.deleted_at IS NULL
    AND c.active IS TRUE
    AND c.deleted_at IS NULL
    AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id
  ORDER BY SUM(oi.quantity) DESC, oi.product_id ASC
  LIMIT 3
$$;
REVOKE ALL ON FUNCTION public.get_public_best_sellers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_best_sellers() TO anon, authenticated;

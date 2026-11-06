-- La Central Burger: ofertas a un único producto sin perder campañas por categoría.
-- Los descuentos no se suman: gana el mayor porcentaje activo.
DO $validate_business$
BEGIN
  IF (SELECT business_name FROM public.business_config WHERE id=1) IS DISTINCT FROM 'La Central Burger' THEN
    RAISE EXCEPTION 'Esta migración corresponde únicamente a La Central Burger.';
  END IF;
END
$validate_business$;

ALTER TABLE public.category_discount_campaigns
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id);

ALTER TABLE public.category_discount_campaigns
  DROP CONSTRAINT IF EXISTS category_discount_campaigns_category_ids_check;
ALTER TABLE public.category_discount_campaigns
  DROP CONSTRAINT IF EXISTS category_discount_target_exactly_one;
ALTER TABLE public.category_discount_campaigns
  ADD CONSTRAINT category_discount_target_exactly_one CHECK (
    array_position(category_ids, NULL::uuid) IS NULL
    AND (
      (product_id IS NULL AND cardinality(category_ids) > 0)
      OR (product_id IS NOT NULL AND cardinality(category_ids) = 0)
    )
  );
CREATE INDEX IF NOT EXISTS category_discount_product_target_idx
  ON public.category_discount_campaigns(product_id, enabled, starts_on, ends_on)
  WHERE product_id IS NOT NULL;

-- Mantiene la validación de categorías existente y agrega el producto puntual.
CREATE OR REPLACE FUNCTION public.validate_discount_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
BEGIN
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'El producto seleccionado no existe o fue eliminado.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.category_ids) selected(id)
    LEFT JOIN public.categories c ON c.id = selected.id AND c.deleted_at IS NULL
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Una o más categorías seleccionadas no existen.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_discount_categories ON public.category_discount_campaigns;
CREATE TRIGGER validate_discount_categories
  BEFORE INSERT OR UPDATE OF category_ids, product_id
  ON public.category_discount_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_discount_categories();

CREATE OR REPLACE FUNCTION public.get_effective_product_discount_percent(
  target_product_id uuid, target_category_id uuid
)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
  SELECT COALESCE(MAX(c.discount_percent),0)
  FROM public.category_discount_campaigns c
  WHERE c.enabled
    AND c.starts_on <= public.business_local_date()
    AND c.ends_on >= public.business_local_date()
    AND (c.product_id = target_product_id OR target_category_id = ANY(c.category_ids));
$function$;
GRANT EXECUTE ON FUNCTION public.get_effective_product_discount_percent(uuid,uuid) TO anon, authenticated;

-- Sobrecarga de 3 argumentos: se mantiene la función antigua para compatibilidad.
CREATE OR REPLACE FUNCTION public.discounted_product_price(
  target_product_id uuid, target_category_id uuid, base_price numeric
)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $function$
  SELECT ROUND(
    GREATEST(COALESCE(base_price,0),0)
    * (1 - public.get_effective_product_discount_percent(target_product_id,target_category_id)/100),
    0
  );
$function$;
GRANT EXECUTE ON FUNCTION public.discounted_product_price(uuid,uuid,numeric) TO anon, authenticated;

-- Ambas rutas de creación de pedidos calculan el descuento del producto y
-- validan el precio del lado del servidor; no se confía en el carrito.
DO $update_orders$
DECLARE
  fn text;
  original_sql text;
  new_sql text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['create_public_order','create_public_order_from_route'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO original_sql
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname=fn
      AND pg_get_function_identity_arguments(p.oid)='payload jsonb';

    IF original_sql IS NULL
      OR STRPOS(original_sql,'public.discounted_product_price(requested_product.category_id, requested_product.current_price)') = 0
      OR STRPOS(original_sql,'public.get_category_discount_percent(requested_product.category_id)') = 0 THEN
      RAISE EXCEPTION 'La función % cambió; revisar antes de modificar.', fn;
    END IF;

    new_sql := REPLACE(
      original_sql,
      'public.discounted_product_price(requested_product.category_id, requested_product.current_price)',
      'public.discounted_product_price(requested_product.id, requested_product.category_id, requested_product.current_price)'
    );
    new_sql := REPLACE(
      new_sql,
      'public.get_category_discount_percent(requested_product.category_id)',
      'public.get_effective_product_discount_percent(requested_product.id, requested_product.category_id)'
    );
    EXECUTE new_sql;
  END LOOP;
END
$update_orders$;

-- Conserva título, porcentaje y precio original de la campaña efectivamente
-- aplicada al momento de crear el pedido, también para promociones individuales.
CREATE OR REPLACE FUNCTION public.capture_order_item_category_discount()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
DECLARE
  base_price numeric;
  product_category uuid;
  selected_campaign record;
BEGIN
  NEW.discount_campaign_id := NULL;
  NEW.discount_campaign_title := NULL;
  NEW.discount_percent := NULL;
  NEW.original_unit_price := NULL;

  IF NEW.product_id IS NULL OR NEW.category_id IS NULL OR NEW.unit_price IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.current_price, p.category_id INTO base_price, product_category
  FROM public.products p WHERE p.id = NEW.product_id;

  IF NOT FOUND OR product_category IS DISTINCT FROM NEW.category_id
    OR base_price <= NEW.unit_price THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.title, c.discount_percent INTO selected_campaign
  FROM public.category_discount_campaigns c
  WHERE c.enabled
    AND (c.product_id = NEW.product_id OR NEW.category_id = ANY(c.category_ids))
    AND c.starts_on <= public.business_local_date()
    AND c.ends_on >= public.business_local_date()
  ORDER BY c.discount_percent DESC, c.created_at ASC, c.id ASC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.unit_price <> ROUND(base_price * (1 - selected_campaign.discount_percent/100),0) THEN
    RETURN NEW;
  END IF;

  NEW.discount_campaign_id := selected_campaign.id;
  NEW.discount_campaign_title := selected_campaign.title;
  NEW.discount_percent := selected_campaign.discount_percent;
  NEW.original_unit_price := base_price;
  NEW.is_promotion := TRUE;
  RETURN NEW;
END;
$function$;

COMMENT ON COLUMN public.category_discount_campaigns.product_id IS
  'Producto único al que aplica la campaña; NULL significa campaña por categorías.';
NOTIFY pgrst, 'reload schema';

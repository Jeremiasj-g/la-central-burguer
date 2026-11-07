-- La Central Burger: una campaña puede incluir varios productos individuales.
-- Compatibilidad: product_id se conserva para clientes antiguos, product_ids es el nuevo selector múltiple.
DO $guard$
BEGIN
  IF (SELECT business_name FROM public.business_config WHERE id=1)
     IS DISTINCT FROM 'La Central Burger' THEN
    RAISE EXCEPTION 'Esta migración solo se aplica a La Central Burger.';
  END IF;
END $guard$;

ALTER TABLE public.category_discount_campaigns
 ADD COLUMN IF NOT EXISTS product_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.category_discount_campaigns
 DROP CONSTRAINT IF EXISTS category_discount_target_exactly_one;

ALTER TABLE public.category_discount_campaigns
 ADD CONSTRAINT category_discount_target_exactly_one CHECK (
   array_position(category_ids, NULL::uuid) IS NULL
   AND array_position(product_ids, NULL::uuid) IS NULL
   AND (
     (cardinality(category_ids) > 0 AND product_id IS NULL AND cardinality(product_ids) = 0)
     OR
     (cardinality(category_ids) = 0 AND product_id IS NOT NULL AND cardinality(product_ids) = 0)
     OR
     (cardinality(category_ids) = 0 AND product_id IS NULL AND cardinality(product_ids) > 0)
   )
 );

CREATE INDEX IF NOT EXISTS category_discount_product_ids_gin
 ON public.category_discount_campaigns USING gin(product_ids);

CREATE OR REPLACE FUNCTION public.validate_discount_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $function$
BEGIN
  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id=NEW.product_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'El producto seleccionado no existe o fue eliminado.' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW.product_ids) selected(id)
    LEFT JOIN public.products p ON p.id=selected.id AND p.deleted_at IS NULL
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Uno o más productos seleccionados no existen o fueron eliminados.' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(NEW.category_ids) selected(id)
    LEFT JOIN public.categories c ON c.id=selected.id AND c.deleted_at IS NULL
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Una o más categorías seleccionadas no existen.' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_discount_categories ON public.category_discount_campaigns;
CREATE TRIGGER validate_discount_categories
BEFORE INSERT OR UPDATE OF category_ids, product_id, product_ids
ON public.category_discount_campaigns
FOR EACH ROW EXECUTE FUNCTION public.validate_discount_categories();

CREATE OR REPLACE FUNCTION public.get_effective_product_discount_percent(
  target_product_id uuid,target_category_id uuid
)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public
AS $function$
  SELECT COALESCE(MAX(c.discount_percent),0)
  FROM public.category_discount_campaigns c
  WHERE c.enabled
    AND c.starts_on <= public.business_local_date()
    AND c.ends_on >= public.business_local_date()
    AND (
      c.product_id=target_product_id
      OR target_product_id=ANY(c.product_ids)
      OR target_category_id=ANY(c.category_ids)
    );
$function$;

-- La captura histórica de precio/promoción debe reconocer también product_ids.
-- Evita modificar cualquier otra lógica del trigger de pedidos.
DO $snapshot$
DECLARE
  current_sql text;
  previous_condition text :=
    '(c.product_id = NEW.product_id OR NEW.category_id = ANY(c.category_ids))';
  next_condition text :=
    '(c.product_id = NEW.product_id OR NEW.product_id = ANY(c.product_ids) OR NEW.category_id = ANY(c.category_ids))';
BEGIN
  SELECT pg_get_functiondef('public.capture_order_item_category_discount()'::regprocedure)
    INTO current_sql;
  IF strpos(current_sql, next_condition) = 0 THEN
    IF strpos(current_sql, previous_condition) = 0 THEN
      RAISE EXCEPTION 'Cambió la captura de descuentos de pedidos, revisar antes de continuar.';
    END IF;
    EXECUTE replace(current_sql,previous_condition,next_condition);
  END IF;
END $snapshot$;

COMMENT ON COLUMN public.category_discount_campaigns.product_ids IS
 'Productos específicos seleccionados (múltiples); no afecta a su categoría completa.';
NOTIFY pgrst,'reload schema';

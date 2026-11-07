-- La Central Burger: editar renglones de pedidos abiertos desde Administración.
-- Los productos existentes conservan precio/snapshot; solo altas usan precios actuales.
-- Edición atómica, control de concurrencia, auditoría y bloqueo de reparto.
DO $business_guard$
BEGIN
  IF (SELECT business_name FROM public.business_config WHERE id = 1) IS DISTINCT FROM 'La Central Burger' THEN
    RAISE EXCEPTION 'Esta migración corresponde únicamente a La Central Burger.';
  END IF;
END $business_guard$;

CREATE TABLE IF NOT EXISTS public.order_item_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  edited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_subtotal numeric NOT NULL,
  new_subtotal numeric NOT NULL,
  previous_items jsonb NOT NULL,
  updated_items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_item_edit_history_by_order
 ON public.order_item_edit_history(order_id,created_at DESC);
ALTER TABLE public.order_item_edit_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_item_edit_history_admin_read ON public.order_item_edit_history;
CREATE POLICY order_item_edit_history_admin_read
 ON public.order_item_edit_history FOR SELECT TO authenticated
 USING ((SELECT private.is_admin()));
REVOKE ALL ON public.order_item_edit_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.order_item_edit_history TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_edit_order_items(
  target_order_id uuid,
  expected_updated_at timestamptz,
  requested_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  target_order public.orders%ROWTYPE;
  existing public.order_items%ROWTYPE;
  product public.products%ROWTYPE;
  category_name text;
  line jsonb;
  line_count integer;
  quantity_value integer;
  note_value text;
  existing_id uuid;
  new_product_id uuid;
  seen_ids uuid[] := ARRAY[]::uuid[];
  previous_snapshot jsonb;
  updated_snapshot jsonb;
  previous_subtotal numeric;
  revised_subtotal numeric;
  timezone_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar pedidos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO target_order FROM public.orders
  WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido ya no existe.' USING ERRCODE = '22023';
  END IF;

  IF target_order.status NOT IN ('pendiente','aceptado','en_preparacion') THEN
    RAISE EXCEPTION 'Solo se pueden editar pedidos pendientes, aceptados o en preparación.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(timezone,''),'America/Argentina/Cordoba')
    INTO timezone_name FROM public.business_config WHERE id = 1;
  timezone_name := COALESCE(timezone_name,'America/Argentina/Cordoba');
  IF (target_order.created_at AT TIME ZONE timezone_name)::date
      IS DISTINCT FROM (now() AT TIME ZONE timezone_name)::date THEN
    RAISE EXCEPTION 'Solo se pueden editar pedidos creados hoy.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    WHERE a.order_id = target_order_id AND a.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'El pedido ya tiene un reparto registrado. Coordiná el cambio antes de editarlo.'
      USING ERRCODE = '22023';
  END IF;

  IF expected_updated_at IS NULL OR target_order.updated_at IS DISTINCT FROM expected_updated_at THEN
    RAISE EXCEPTION 'El pedido cambió desde que lo abriste. Actualizá la lista y volvé a intentar.'
      USING ERRCODE = '40001';
  END IF;

  IF jsonb_typeof(requested_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La lista de productos es inválida.' USING ERRCODE = '22023';
  END IF;
  line_count := jsonb_array_length(requested_items);
  IF line_count NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'El pedido debe tener entre 1 y 50 renglones.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',i.id,'productId',i.product_id,'name',i.product_name,
    'quantity',i.quantity,'unitPrice',i.unit_price,'note',i.note
  ) ORDER BY i.created_at,i.id),'[]'::jsonb)
  INTO previous_snapshot FROM public.order_items i WHERE i.order_id=target_order_id;
  previous_subtotal := target_order.subtotal;

  -- Validar ítems, preservar el precio histórico de los existentes.
  FOR line IN SELECT value FROM jsonb_array_elements(requested_items)
  LOOP
    IF jsonb_typeof(line) <> 'object' OR (line ->> 'quantity') !~ '^[0-9]{1,2}$' THEN
      RAISE EXCEPTION 'La cantidad de un producto no es válida.' USING ERRCODE = '22023';
    END IF;
    quantity_value := (line ->> 'quantity')::integer;
    IF quantity_value < 1 OR quantity_value > 99 THEN
      RAISE EXCEPTION 'Cada producto debe tener entre 1 y 99 unidades.' USING ERRCODE = '22023';
    END IF;
    note_value := NULLIF(btrim(COALESCE(line ->> 'note','')),'');
    IF length(COALESCE(note_value,'')) > 500 THEN
      RAISE EXCEPTION 'Una aclaración supera los 500 caracteres.' USING ERRCODE = '22023';
    END IF;

    IF NULLIF(line ->> 'itemId','') IS NOT NULL THEN
      existing_id := (line ->> 'itemId')::uuid;
      IF existing_id = ANY(seen_ids) THEN
        RAISE EXCEPTION 'Un producto se envió repetido en la edición.' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO existing FROM public.order_items
      WHERE id=existing_id AND order_id=target_order_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Uno de los renglones ya no pertenece a este pedido.' USING ERRCODE = '22023';
      END IF;
      seen_ids := array_append(seen_ids,existing_id);
      UPDATE public.order_items
      SET quantity=quantity_value,note=note_value
      WHERE id=existing_id;
    ELSE
      IF NULLIF(line ->> 'productId','') IS NULL THEN
        RAISE EXCEPTION 'Falta seleccionar un producto.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  -- Renglones quitados por el operador.
  DELETE FROM public.order_items
  WHERE order_id=target_order_id AND NOT (id=ANY(seen_ids));

  -- Altas con el catálogo y los descuentos de hoy, nunca con precios enviados
  -- por el navegador. El trigger toma la promoción histórica en cada alta.
  FOR line IN SELECT value FROM jsonb_array_elements(requested_items)
  LOOP
    IF NULLIF(line ->> 'itemId','') IS NOT NULL THEN CONTINUE; END IF;
    new_product_id := (line ->> 'productId')::uuid;
    quantity_value := (line ->> 'quantity')::integer;
    note_value := NULLIF(btrim(COALESCE(line ->> 'note','')),'');

    SELECT p.* INTO product
    FROM public.products p JOIN public.categories c ON c.id=p.category_id
    WHERE p.id=new_product_id
      AND p.active AND p.available AND p.deleted_at IS NULL
      AND c.active AND c.deleted_at IS NULL
    FOR SHARE OF p,c;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Un producto ya no está disponible. Actualizá el catálogo.'
        USING ERRCODE = '22023';
    END IF;
    SELECT c.name::text INTO category_name FROM public.categories c WHERE c.id=product.category_id;

    INSERT INTO public.order_items(
      order_id,product_id,category_id,product_name,category_name,image_url,
      is_promotion,quantity,unit_price,note
    ) VALUES (
      target_order_id,product.id,product.category_id,product.name::text,
      category_name,product.image_url,
      (product.is_promotion OR public.get_effective_product_discount_percent(product.id,product.category_id)>0),
      quantity_value,
      public.discounted_product_price(product.id,product.category_id,product.current_price),
      note_value
    );
  END LOOP;

  SELECT COALESCE(sum(i.total),0) INTO revised_subtotal
  FROM public.order_items i WHERE i.order_id=target_order_id;
  IF revised_subtotal < 0 THEN
    RAISE EXCEPTION 'Subtotal inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',i.id,'productId',i.product_id,'name',i.product_name,
    'quantity',i.quantity,'unitPrice',i.unit_price,'note',i.note
  ) ORDER BY i.created_at,i.id),'[]'::jsonb)
  INTO updated_snapshot FROM public.order_items i WHERE i.order_id=target_order_id;

  IF updated_snapshot = previous_snapshot THEN
    RAISE EXCEPTION 'No hay cambios para guardar.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders SET subtotal=revised_subtotal WHERE id=target_order_id;

  INSERT INTO public.order_item_edit_history(
    order_id,edited_by,previous_subtotal,new_subtotal,previous_items,updated_items
  ) VALUES (
    target_order_id,auth.uid(),previous_subtotal,revised_subtotal,
    previous_snapshot,updated_snapshot
  );

  RETURN jsonb_build_object(
    'orderId',target_order_id,
    'oldTotal',previous_subtotal+target_order.delivery_cost,
    'newTotal',revised_subtotal+target_order.delivery_cost,
    'difference',revised_subtotal-previous_subtotal
  );
END
$fn$;

REVOKE ALL ON FUNCTION public.admin_edit_order_items(uuid,timestamptz,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_edit_order_items(uuid,timestamptz,jsonb) TO authenticated;

COMMENT ON FUNCTION public.admin_edit_order_items(uuid,timestamptz,jsonb) IS
 'Permite edición auditada de renglones de pedidos recientes sin recalcular precios históricos.';
NOTIFY pgrst,'reload schema';

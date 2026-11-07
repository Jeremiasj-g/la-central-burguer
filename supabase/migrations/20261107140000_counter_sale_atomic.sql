-- Venta de mostrador transaccional: pedido, productos y cobros se confirman juntos.
CREATE OR REPLACE FUNCTION public.admin_create_counter_sale(checkout jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 actor uuid := auth.uid();
 name_value text := left(btrim(COALESCE(checkout->>'customerName','Venta mostrador')),120);
 phone_value text := left(btrim(COALESCE(checkout->>'customerPhone','Sin teléfono')),40);
 customer uuid := NULLIF(checkout->>'customerId','')::uuid;
 preference text := checkout->>'paymentMethod';
 counter_note text := left(COALESCE(checkout->>'notes',''),1000);
 items jsonb := checkout->'items';
 line jsonb;
 item_qty integer;
 product public.products%ROWTYPE;
 category_name text;
 order_uuid uuid;
 code text;
 subtotal_value numeric := 0;
 total_value numeric;
 transfer_value numeric;
BEGIN
 IF actor IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'Sin permiso para registrar ventas.' USING ERRCODE='42501'; END IF;
 IF preference NOT IN ('efectivo','transferencia','mixto') OR preference IS NULL THEN
   RAISE EXCEPTION 'Seleccioná un medio de pago.' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.payment_methods m
   WHERE m.active AND m.code = (CASE WHEN preference='mixto' THEN 'efectivo' ELSE preference END)::public.payment_method_code)
    OR (preference='mixto' AND NOT EXISTS(SELECT 1 FROM public.payment_methods m WHERE m.code='transferencia' AND m.active))
 THEN RAISE EXCEPTION 'El medio de pago no está habilitado.' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(items)<>'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Agregá entre 1 y 50 productos.' USING ERRCODE='22023';
 END IF;
 IF name_value='' THEN name_value:='Venta mostrador'; END IF;
 IF phone_value='' THEN phone_value:='Sin teléfono'; END IF;

 -- Computar y validar los precios en la base, no desde el navegador.
 FOR line IN SELECT value FROM jsonb_array_elements(items) LOOP
   IF (line->>'quantity') !~ '^[0-9]{1,2}$' OR (line->>'productId') IS NULL THEN
      RAISE EXCEPTION 'Cantidad o producto inválido.' USING ERRCODE='22023';
   END IF;
   item_qty := (line->>'quantity')::integer;
   IF item_qty NOT BETWEEN 1 AND 99 THEN RAISE EXCEPTION 'Cantidad inválida.' USING ERRCODE='22023'; END IF;
   SELECT p.* INTO product FROM public.products p JOIN public.categories c ON c.id=p.category_id
   WHERE p.id=(line->>'productId')::uuid AND p.deleted_at IS NULL AND p.active
     AND p.available AND c.deleted_at IS NULL AND c.active;
   IF NOT FOUND THEN RAISE EXCEPTION 'Un producto ya no está disponible.' USING ERRCODE='22023'; END IF;
   subtotal_value := subtotal_value + item_qty * product.current_price;
 END LOOP;
 IF subtotal_value<=0 THEN RAISE EXCEPTION 'El importe de la venta no es válido.' USING ERRCODE='22023'; END IF;
 total_value := subtotal_value;

 IF preference='transferencia' THEN
   transfer_value:=total_value;
 ELSIF preference='efectivo' THEN
   transfer_value:=0;
 ELSE
   BEGIN transfer_value:=(checkout->>'transferAmount')::numeric;
   EXCEPTION WHEN others THEN RAISE EXCEPTION 'Ingresá el importe transferido.' USING ERRCODE='22023'; END;
   IF transfer_value IS NULL OR transfer_value<=0 OR transfer_value>=total_value OR transfer_value<>ROUND(transfer_value,2) THEN
      RAISE EXCEPTION 'El pago combinado requiere dos importes positivos que sumen el total.' USING ERRCODE='22023';
   END IF;
 END IF;
 code:=public.generate_order_code();
 INSERT INTO public.orders(order_code,customer_id,customer_name,customer_phone,
    delivery_method,payment_method,payment_preference,payment_tracking_enabled,
    subtotal,delivery_cost,status,notes,source)
 VALUES(code,customer,name_value,phone_value,'retiro_local',
    (CASE WHEN preference='mixto' THEN 'efectivo' ELSE preference END)::public.payment_method_code,
    preference,TRUE,subtotal_value,0,'entregado',counter_note,'admin')
 RETURNING id INTO order_uuid;

 FOR line IN SELECT value FROM jsonb_array_elements(items) LOOP
   SELECT p.* INTO product FROM public.products p WHERE p.id=(line->>'productId')::uuid;
   SELECT c.name INTO category_name FROM public.categories c WHERE c.id=product.category_id;
   INSERT INTO public.order_items(order_id,product_id,category_id,product_name,category_name,image_url,
      is_promotion,quantity,unit_price,note)
   VALUES(order_uuid,product.id,product.category_id,product.name,category_name,
      product.image_url,product.is_promotion,(line->>'quantity')::integer,product.current_price,NULL);
 END LOOP;
 UPDATE public.order_payment_plans
 SET transfer_expected=transfer_value,updated_by=actor,updated_at=now()
 WHERE order_id=order_uuid;
 IF transfer_value>0 THEN
   INSERT INTO public.order_payment_movements(order_id,method,amount,movement_type,source,request_id,actor_id,note)
   VALUES(order_uuid,'transferencia',transfer_value,'receipt','counter',gen_random_uuid(),actor,'Cobro al finalizar venta mostrador');
 END IF;
 IF total_value-transfer_value>0 THEN
   INSERT INTO public.order_payment_movements(order_id,method,amount,movement_type,source,request_id,actor_id,note)
   VALUES(order_uuid,'efectivo',total_value-transfer_value,'receipt','counter',gen_random_uuid(),actor,'Cobro al finalizar venta mostrador');
 END IF;
 RETURN jsonb_build_object('orderId',order_uuid,'orderCode',code,'total',total_value);
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_create_counter_sale(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_counter_sale(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.orders_prevent_payment_overrun()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NEW.payment_tracking_enabled AND NEW.subtotal+NEW.delivery_cost
    < private.payment_received(NEW.id) THEN
   RAISE EXCEPTION 'El nuevo total es menor que el dinero cobrado. Registrá primero el reintegro o corrección.'
     USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.orders_prevent_payment_overrun() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS orders_prevent_payment_overrun ON public.orders;
CREATE TRIGGER orders_prevent_payment_overrun
 BEFORE UPDATE OF subtotal,delivery_cost ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.orders_prevent_payment_overrun();

-- La venta de mostrador puede corregirse después de entregada, pero nunca
-- un delivery entregado (cuya rendición ya puede estar en curso).
DO $patch_counter$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef('public.admin_set_order_payment_plan(uuid,numeric)'::regprocedure) INTO body;
 IF strpos(body,'IF o.status IN (''cancelado'',''entregado'') THEN')=0 THEN
   RAISE EXCEPTION 'El control de edición del plan cambió.';
 END IF;
 body:=replace(body,
   'IF o.status IN (''cancelado'',''entregado'') THEN',
   'IF o.status=''cancelado'' OR (o.status=''entregado'' AND o.delivery_method=''delivery'') THEN');
 EXECUTE body;
END $patch_counter$;
NOTIFY pgrst,'reload schema';
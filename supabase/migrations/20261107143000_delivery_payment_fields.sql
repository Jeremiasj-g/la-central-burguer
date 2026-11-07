-- Expone únicamente estado financiero mínimo en dashboards autorizados de delivery.
-- Los movimientos individuales se consultan en Administración mediante RPC.
DO $extend_driver$
DECLARE fn text; body text; original text;
BEGIN
 FOREACH fn IN ARRAY ARRAY[
   'get_delivery_admin_dashboard','get_delivery_driver_dashboard',
   'get_delivery_driver_delivery_detail'
 ] LOOP
   SELECT pg_get_functiondef(p.oid) INTO body
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=fn;
   original:=body;
   body:=replace(body,
     '''paymentMethod'', o.payment_method',
     '''paymentMethod'', o.payment_method, ''paymentPreference'',coalesce(o.payment_preference,o.payment_method::text),'||
       ' ''paymentTrackingEnabled'',o.payment_tracking_enabled,'||
       ' ''transferExpected'',(select p.transfer_expected from public.order_payment_plans p where p.order_id=o.id),'||
       ' ''transferConfirmed'',private.payment_received(o.id,''transferencia'')');
   body:=replace(body,
     '''paymentMethod'',o.payment_method',
     '''paymentMethod'',o.payment_method,''paymentPreference'',coalesce(o.payment_preference,o.payment_method::text),'||
       '''paymentTrackingEnabled'',o.payment_tracking_enabled,'||
       '''transferExpected'',(select p.transfer_expected from public.order_payment_plans p where p.order_id=o.id),'||
       '''transferConfirmed'',private.payment_received(o.id,''transferencia'')');
   IF body=original THEN
     RAISE EXCEPTION 'No se encontró paymentMethod en el dashboard %.',fn;
   END IF;
   EXECUTE body;
 END LOOP;
END $extend_driver$;

-- Impedir recontabilizar rendiciones una vez abonadas mediante reversión
-- (las rectificaciones históricas requieren un movimiento de ajuste separado).
NOTIFY pgrst,'reload schema';
-- La Central Burger — integración de preferencias, reparto y liquidaciones.
-- Debe ejecutarse después de 20261107130000_unified_payment_ledger.sql.

DO $rewrite$
DECLARE
 fn text;
 body text;
 original text;
 prefix text;
 suffix text;
 oldcash text;
 newcash text := 'private.payment_cash_for_settlement(da.id)';
BEGIN
 FOREACH fn IN ARRAY ARRAY['create_public_order','create_public_order_from_route'] LOOP
   SELECT pg_get_functiondef(p.oid) INTO body
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname=fn
     AND pg_get_function_identity_arguments(p.oid)='payload jsonb';
   IF body IS NULL OR position('chosen_payment := (payload ->> ''paymentMethod'')::public.payment_method_code;' in body)=0
     OR position('    payment_method,' in body)=0 THEN
     RAISE EXCEPTION 'La firma/implementación de % cambió; revisar migración.',fn;
   END IF;
   original:=body;
   body:=replace(body,
      '  chosen_payment public.payment_method_code;',
      '  chosen_payment public.payment_method_code;'||chr(10)||
      '  chosen_preference text := NULLIF(payload ->> ''paymentMethod'', '''');');
   body:=replace(body,
      'chosen_payment := (payload ->> ''paymentMethod'')::public.payment_method_code;',
      'chosen_payment := (CASE WHEN chosen_preference = ''mixto'' THEN ''efectivo'' ELSE chosen_preference END)::public.payment_method_code;');
   IF position('  if not exists (' in body)=0 THEN RAISE EXCEPTION 'No se encontró validación pago en %.',fn; END IF;
   body:=replace(body,
      '  if not exists ('||chr(10)||'    select 1',
      '  if chosen_preference = ''mixto'' AND NOT EXISTS ('||chr(10)||
      '    SELECT 1 FROM public.payment_methods pm WHERE pm.code = ''transferencia'' AND pm.active = true'||chr(10)||
      '  ) THEN RAISE EXCEPTION ''Pago combinado no disponible.'' USING ERRCODE = ''22023''; END IF;'||chr(10)||
      '  if not exists ('||chr(10)||'    select 1');
   -- Caso de espaciado alternativo: el chequeo anterior se puede insertar
   -- justo antes de la verificación del medio habilitado.
   IF position('Pago combinado no disponible.' in body)=0 THEN
     body:=replace(body,
       '  if not exists ('||chr(10)||'    select 1 from public.payment_methods pm',
       '  if chosen_preference = ''mixto'' AND NOT EXISTS ('||chr(10)||
       '    SELECT 1 FROM public.payment_methods pm WHERE pm.code = ''transferencia'' AND pm.active = true'||chr(10)||
       '  ) THEN RAISE EXCEPTION ''Pago combinado no disponible.'' USING ERRCODE = ''22023''; END IF;'||chr(10)||
       '  if not exists ('||chr(10)||'    select 1 from public.payment_methods pm');
   END IF;
   IF position('Pago combinado no disponible.' in body)=0 THEN
      RAISE EXCEPTION 'No se pudo agregar verificación de pago mixto en %.',fn;
   END IF;
   body:=replace(body,
       '    payment_method,'||chr(10)||'    subtotal,',
       '    payment_method,'||chr(10)||'    payment_preference,'||chr(10)||
       '    payment_tracking_enabled,'||chr(10)||'    subtotal,');
   body:=replace(body,
       '    chosen_payment,'||chr(10)||'    calculated_subtotal,',
       '    chosen_payment,'||chr(10)||'    chosen_preference,'||chr(10)||
       '    TRUE,'||chr(10)||'    calculated_subtotal,');
   body:=replace(body,
       'return private.get_order_json(new_order_id);',
       'return private.get_order_json(new_order_id) || jsonb_build_object(''paymentPreference'', chosen_preference);');
   body:=replace(body,
       'return private.get_order_json_route(new_order_id);',
       'return private.get_order_json_route(new_order_id) || jsonb_build_object(''paymentPreference'', chosen_preference);');
   IF position('    payment_preference,' in body)=0 OR body=original THEN
      RAISE EXCEPTION 'No se pudo ampliar la creación pública %.',fn;
   END IF;
   EXECUTE body;
 END LOOP;

 -- La asignación requiere que toda transferencia comprometida se haya acreditado.
 SELECT pg_get_functiondef('public.admin_assign_delivery(uuid,uuid,text,numeric)'::regprocedure) INTO body;
 IF position(' if not exists(select 1 from public.delivery_drivers' in body)=0 THEN
    RAISE EXCEPTION 'Cambió la validación de asignación.';
 END IF;
 body:=replace(body,
    ' if not exists(select 1 from public.delivery_drivers',
    ' if o.payment_tracking_enabled THEN '||
    'IF NOT EXISTS(SELECT 1 FROM public.order_payment_plans p WHERE p.order_id=o.id AND p.transfer_expected IS NOT NULL) '||
    'THEN RAISE EXCEPTION ''Definí el desglose de cobro antes de asignar.'' USING ERRCODE=''22023''; END IF; '||
    'IF private.payment_received(o.id,''transferencia'') < (SELECT p.transfer_expected FROM public.order_payment_plans p WHERE p.order_id=o.id) '||
    'THEN RAISE EXCEPTION ''Verificá la transferencia prevista antes de asignar el delivery.'' USING ERRCODE=''22023''; END IF; '||
    'END IF;'||chr(10)||
    ' if not exists(select 1 from public.delivery_drivers');
 EXECUTE body;

 -- Entrega atómica: confirmar efectivo exacto y pasar a entregado en la
 -- misma transacción, sin permitir una segunda confirmación del reparto.
 SELECT pg_get_functiondef('public.driver_advance_delivery(uuid,delivery_assignment_status,text)'::regprocedure) INTO body;
 IF position('  update public.delivery_assignments' in body)=0 THEN
   RAISE EXCEPTION 'Cambió la transición de entregas.';
 END IF;
 body:=replace(body,
   '  allowed boolean := false;',
   '  allowed boolean := false;'||chr(10)||'  cash_due numeric;'||chr(10)||
   '  enabled_tracking boolean;');
 body:=replace(body,
    '  update public.delivery_assignments',
    '  IF next_status = ''delivered'' THEN'||chr(10)||
    '    SELECT o.payment_tracking_enabled INTO enabled_tracking FROM public.orders o WHERE o.id=current_assignment.order_id FOR UPDATE;'||chr(10)||
    '    IF enabled_tracking THEN'||chr(10)||
    '      cash_due := private.payment_cash_to_collect(current_assignment.order_id);'||chr(10)||
    '      IF cash_due IS NULL THEN RAISE EXCEPTION ''El local debe verificar el pago antes de entregar.'' USING ERRCODE=''22023''; END IF;'||chr(10)||
    '      IF cash_due > 0 THEN'||chr(10)||
    '        INSERT INTO public.order_payment_movements(order_id,method,amount,movement_type,source,assignment_id,request_id,actor_id,note)'||chr(10)||
    '        VALUES(current_assignment.order_id,''efectivo'',cash_due,''receipt'',''driver'',assignment_uuid,gen_random_uuid(),driver,''Efectivo recibido al entregar'');'||chr(10)||
    '      END IF;'||chr(10)||
    '    END IF;'||chr(10)||
    '  END IF;'||chr(10)||chr(10)||
    '  update public.delivery_assignments');
 EXECUTE body;

 -- Dashboard y liquidaciones mantienen la clasificación histórica de
 -- ventas antiguas; las nuevas se basan en recibos reales por repartidor.
 FOREACH fn IN ARRAY ARRAY['get_delivery_admin_dashboard','get_delivery_driver_dashboard','get_delivery_driver_delivery_detail'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO body FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=fn;
  IF body IS NULL THEN RAISE EXCEPTION 'Función % no encontrada.',fn; END IF;
  original:=body;
  body:=replace(body,
     'case when o.payment_method = ''efectivo'' then o.total else 0 end',
     'private.payment_cash_for_settlement(da.id)');
  body:=replace(body,
     'case when o.payment_method=''efectivo'' then o.total else 0 end',
     'private.payment_cash_for_settlement(da.id)');
  body:=replace(body,
     '''cashToCollect'', private.payment_cash_for_settlement(da.id)',
     '''cashToCollect'', private.payment_cash_to_collect(o.id)');
  body:=replace(body,
     '''cashToCollect'',private.payment_cash_for_settlement(da.id)',
     '''cashToCollect'',private.payment_cash_to_collect(o.id)');
  -- Resúmenes de entregas ya finalizadas muestran el efectivo recibido.
  -- En vistas de detalle entregadas el amount es histórico, no pendiente.
  IF fn='get_delivery_driver_delivery_detail' THEN
     body:=replace(body,
       '''cashToCollect'', private.payment_cash_to_collect(o.id)',
       '''cashToCollect'', private.payment_cash_for_settlement(da.id)');
  END IF;
  IF body=original THEN RAISE EXCEPTION 'No se encontró cálculo de efectivo en %.',fn; END IF;
  EXECUTE body;
 END LOOP;

 SELECT pg_get_functiondef('public.admin_delivery_cash_pending_details()'::regprocedure) INTO body;
 IF body IS NULL THEN RAISE EXCEPTION 'Falta el detalle de rendición.'; END IF;
 body:=replace(body,'o.total::numeric','private.payment_cash_for_settlement(da.id)::numeric');
 body:=replace(body,'AND o.payment_method = ''efectivo''',
   'AND private.payment_cash_for_settlement(da.id) > 0');
 EXECUTE body;

 -- Impedir reducción de subtotal por debajo de cobros verificados.
 SELECT pg_get_functiondef('public.admin_edit_order_items(uuid,timestamptz,jsonb)'::regprocedure) INTO body;
 IF position('  IF revised_subtotal < 0 THEN' in body)=0 THEN
    RAISE EXCEPTION 'Cambió el editor de pedidos.';
 END IF;
 body:=replace(body,'  IF revised_subtotal < 0 THEN',
   '  IF target_order.payment_tracking_enabled AND '||
   'revised_subtotal + target_order.delivery_cost < private.payment_received(target_order_id) THEN '||
   'RAISE EXCEPTION ''El nuevo total sería menor que lo ya cobrado. Registrá primero el reintegro o corrección.'' USING ERRCODE=''22023''; '||
   'END IF;'||chr(10)||'  IF revised_subtotal < 0 THEN');
 EXECUTE body;
END $rewrite$;

NOTIFY pgrst,'reload schema';
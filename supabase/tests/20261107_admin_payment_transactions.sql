-- Requiere la fundación y las RPC administrativas instaladas en una base de PRUEBAS.
-- Usa un pedido existente únicamente DENTRO de una transacción que se revierte.
BEGIN;
DO $test$
DECLARE
  aid uuid;
  target_id uuid;
  target_total numeric;
  amount_transfer numeric;
  amount_cash numeric;
  k1 uuid:=gen_random_uuid();
  k2 uuid:=gen_random_uuid();
  k3 uuid:=gen_random_uuid();
  k4 uuid:=gen_random_uuid();
  result jsonb;
  denied boolean:=false;
BEGIN
  SELECT ur.user_id INTO aid
  FROM public.user_roles ur JOIN public.roles r ON r.id=ur.role_id
  JOIN public.profiles p ON p.id=ur.user_id
  WHERE lower(r.code)='admin' AND r.active AND p.active AND p.archived_at IS NULL LIMIT 1;
  IF aid IS NULL THEN RAISE EXCEPTION 'Falta un admin activo de pruebas';END IF;
  PERFORM set_config('request.jwt.claim.sub',aid::text,true);
  IF NOT private.is_admin() THEN RAISE EXCEPTION 'No se reconoció el admin'; END IF;

  SELECT o.id,o.total INTO target_id,target_total FROM public.orders o
  WHERE o.delivery_method='retiro_local' AND o.status <> 'cancelado' AND o.total>10
  ORDER BY o.created_at DESC LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'Falta un pedido de pruebas'; END IF;
  amount_transfer:=ROUND(target_total*.4,2);
  amount_cash:=target_total-amount_transfer;
  PERFORM public.admin_set_order_payment_plan(target_id,amount_transfer,amount_cash);
  IF (SELECT payment_preference FROM public.orders WHERE id=target_id)<>'combinado'
    THEN RAISE EXCEPTION 'La preferencia no se sincronizó';END IF;

  result:=public.admin_confirm_order_payment(target_id,'transferencia',amount_transfer,k1);
  IF (result->>'repeated')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'Alta inválida';END IF;
  result:=public.admin_confirm_order_payment(target_id,'transferencia',amount_transfer,k1);
  IF (result->>'repeated')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'Duplicación por reintento';END IF;
  BEGIN
    PERFORM public.admin_confirm_order_payment(target_id,'transferencia',amount_transfer,k2);
  EXCEPTION WHEN SQLSTATE '22023' THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Se permitió un importe excedente'; END IF;
  PERFORM public.admin_confirm_order_payment(target_id,'efectivo',amount_cash,k3);
  PERFORM public.admin_reverse_order_payment(
    (SELECT m.id FROM public.order_payment_movements m WHERE m.idempotency_key=k1),
    'Medio de pago incorrecto en prueba',k4
  );
  IF (SELECT COALESCE(SUM(CASE WHEN m.kind='payment' THEN m.amount ELSE -m.amount END),0)
      FROM public.order_payment_movements m WHERE m.order_id=target_id AND m.method='transferencia')<>0
    THEN RAISE EXCEPTION 'La reversión no recalculó el saldo';END IF;

  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  denied:=false;
  BEGIN
    PERFORM public.admin_confirm_order_payment(target_id,'transferencia',amount_transfer,gen_random_uuid());
  EXCEPTION WHEN insufficient_privilege THEN denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Se permitió un cobro sin rol admin';END IF;
  IF has_function_privilege('anon','public.admin_confirm_order_payment(uuid,public.payment_method_code,numeric,uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'El RPC está disponible para usuarios anónimos';END IF;
  RAISE NOTICE 'OK: preferencias, cobros, reintentos, límites, reversión y permisos. ROLLBACK.';
END $test$;
ROLLBACK;

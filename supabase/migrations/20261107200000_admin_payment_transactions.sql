-- Phase 2. Execute after the unified payment foundation migration.
-- No historic payment is backfilled or silently considered confirmed.
-- All financial mutations serialize against the order row and are admin-only.
CREATE OR REPLACE FUNCTION public.admin_set_order_payment_plan(
  target_order_id uuid,
  transfer_value numeric,
  cash_value numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  current_order public.orders%ROWTYPE;
  paid_transfer numeric(12,2);
  paid_cash numeric(12,2);
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para modificar cobros.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_order
  FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos el pedido.' USING ERRCODE = '22023';
  END IF;
  IF current_order.status = 'cancelado' THEN
    RAISE EXCEPTION 'No se puede planificar un cobro en un pedido cancelado.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE order_id = target_order_id AND status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'El reparto ya fue asignado. No se puede cambiar el plan de cobro.' USING ERRCODE = '22023';
  END IF;
  IF transfer_value IS NULL OR cash_value IS NULL
    OR transfer_value < 0 OR cash_value < 0
    OR transfer_value <> round(transfer_value,2) OR cash_value <> round(cash_value,2)
    OR transfer_value > 9999999999.99 OR cash_value > 9999999999.99
    OR transfer_value + cash_value <> current_order.total
  THEN
    RAISE EXCEPTION 'La suma de transferencia y efectivo debe coincidir exactamente con el total.' USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN method = 'transferencia'
      THEN CASE WHEN kind = 'payment' THEN amount ELSE -amount END ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN method = 'efectivo'
      THEN CASE WHEN kind = 'payment' THEN amount ELSE -amount END ELSE 0 END),0)
  INTO paid_transfer, paid_cash
  FROM public.order_payment_movements WHERE order_id = target_order_id;
  IF paid_transfer > transfer_value OR paid_cash > cash_value THEN
    RAISE EXCEPTION 'La distribución no puede ser menor a los importes ya cobrados.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.order_payment_plans (order_id, transfer_amount, cash_amount, updated_by)
  VALUES (target_order_id,transfer_value,cash_value,auth.uid())
  ON CONFLICT (order_id) DO UPDATE SET
    transfer_amount = EXCLUDED.transfer_amount,
    cash_amount = EXCLUDED.cash_amount,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  RETURN jsonb_build_object(
    'orderId',target_order_id,'total',current_order.total,
    'transfer',transfer_value,'cash',cash_value
  );
END $fn$;
REVOKE ALL ON FUNCTION public.admin_set_order_payment_plan(uuid,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_payment_plan(uuid,numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_confirm_order_payment(
  target_order_id uuid,
  payment_method public.payment_method_code,
  payment_amount numeric,
  request_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  current_order public.orders%ROWTYPE;
  plan public.order_payment_plans%ROWTYPE;
  prior public.order_payment_movements%ROWTYPE;
  collected numeric(12,2);
  target_amount numeric(12,2);
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para confirmar cobros.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_order FROM public.orders WHERE id = target_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos el pedido.' USING ERRCODE = '22023';
  END IF;

  -- The same idempotency key can return its original result but cannot be
  -- reused for a different payment, even after an order changes status.
  SELECT * INTO prior FROM public.order_payment_movements WHERE idempotency_key = request_key;
  IF FOUND THEN
    IF prior.order_id <> target_order_id OR prior.method <> payment_method
      OR prior.amount <> payment_amount OR prior.kind <> 'payment' OR prior.source <> 'admin' THEN
      RAISE EXCEPTION 'La confirmación ya se utilizó en otra operación.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('movementId',prior.id,'repeated',true);
  END IF;

  IF request_key IS NULL OR payment_method IS NULL OR payment_amount IS NULL
    OR payment_amount <= 0 OR payment_amount <> round(payment_amount,2)
    OR payment_amount > 9999999999.99 THEN
    RAISE EXCEPTION 'Ingresá un importe válido mayor a cero.' USING ERRCODE = '22023';
  END IF;
  IF current_order.status = 'cancelado' THEN
    RAISE EXCEPTION 'No se pueden registrar cobros nuevos en pedidos cancelados.' USING ERRCODE = '22023';
  END IF;
  IF payment_method = 'efectivo' AND current_order.delivery_method = 'delivery' THEN
    RAISE EXCEPTION 'El efectivo de delivery debe confirmarlo el repartidor al entregar.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO plan FROM public.order_payment_plans
  WHERE order_id = target_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guardá primero la distribución de pago del pedido.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END),0)
  INTO collected FROM public.order_payment_movements
  WHERE order_id = target_order_id AND method = payment_method;
  target_amount := CASE WHEN payment_method = 'transferencia'
    THEN plan.transfer_amount ELSE plan.cash_amount END;

  IF collected + payment_amount > target_amount THEN
    RAISE EXCEPTION 'El importe supera el saldo previsto para ese medio de pago.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE order_id = target_order_id AND status = 'delivered'
  ) THEN
    RAISE EXCEPTION 'Un pedido con reparto ya entregado necesita revisión antes de registrar nuevos cobros.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.order_payment_movements (
    order_id,method,amount,kind,source,idempotency_key,confirmed_by
  ) VALUES (
    target_order_id,payment_method,payment_amount,'payment','admin',request_key,auth.uid()
  ) RETURNING id INTO new_id;
  RETURN jsonb_build_object('movementId',new_id,'repeated',false);
END $fn$;
REVOKE ALL ON FUNCTION public.admin_confirm_order_payment(uuid,public.payment_method_code,numeric,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_order_payment(uuid,public.payment_method_code,numeric,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reverse_order_payment(
  target_movement_id uuid,
  correction_reason text,
  request_key uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  movement public.order_payment_movements%ROWTYPE;
  prior public.order_payment_movements%ROWTYPE;
  order_row public.orders%ROWTYPE;
  reversed_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'No tenés permisos para corregir cobros.' USING ERRCODE = '42501';
  END IF;
  IF request_key IS NULL OR length(btrim(coalesce(correction_reason,''))) < 8 THEN
    RAISE EXCEPTION 'Indicá el motivo de la corrección (al menos 8 caracteres).' USING ERRCODE = '22023';
  END IF;
  -- Lock order first, consistent with all other payment RPCs.
  SELECT m.order_id INTO movement.order_id FROM public.order_payment_movements m WHERE m.id = target_movement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos el movimiento.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO order_row FROM public.orders WHERE id = movement.order_id FOR UPDATE;

  SELECT * INTO prior FROM public.order_payment_movements WHERE idempotency_key = request_key;
  IF FOUND THEN
    IF prior.kind <> 'reversal' OR prior.related_movement_id <> target_movement_id THEN
      RAISE EXCEPTION 'La confirmación ya se utilizó en otra operación.' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('movementId',prior.id,'repeated',true);
  END IF;

  SELECT * INTO movement FROM public.order_payment_movements WHERE id = target_movement_id;
  IF movement.kind <> 'payment' OR movement.source = 'delivery' THEN
    RAISE EXCEPTION 'Este movimiento requiere un ajuste especial de liquidación.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.order_payment_movements
    WHERE related_movement_id = target_movement_id AND kind IN ('reversal','refund')
  ) THEN
    RAISE EXCEPTION 'Este cobro ya fue revertido o reintegrado.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments a
    WHERE a.order_id = movement.order_id AND a.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'No se puede revertir dinero de un pedido con reparto registrado.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.order_payment_movements (
    order_id,method,amount,kind,source,idempotency_key,confirmed_by,related_movement_id,reason
  ) VALUES (
    movement.order_id,movement.method,movement.amount,'reversal','admin',
    request_key,auth.uid(),movement.id,btrim(correction_reason)
  ) RETURNING id INTO reversed_id;
  RETURN jsonb_build_object('movementId',reversed_id,'repeated',false);
END $fn$;
REVOKE ALL ON FUNCTION public.admin_reverse_order_payment(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reverse_order_payment(uuid,text,uuid) TO authenticated;

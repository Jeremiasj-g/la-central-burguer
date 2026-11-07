-- La Central Burger — cobros verificados independientes del pedido, 2026-11-07.
-- Compatibilidad: todas las ventas existentes permanecen como legado declarado.
DO $scope$
BEGIN
 IF (SELECT business_name FROM public.business_config WHERE id=1) IS DISTINCT FROM 'La Central Burger'
 THEN RAISE EXCEPTION 'Migración destinada a La Central Burger.'; END IF;
END $scope$;

ALTER TABLE public.orders
 ADD COLUMN IF NOT EXISTS payment_preference text,
 ADD COLUMN IF NOT EXISTS payment_tracking_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_preference_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_preference_check
 CHECK (payment_preference IS NULL OR payment_preference IN ('efectivo','transferencia','mixto'));

CREATE TABLE IF NOT EXISTS public.order_payment_plans (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  transfer_expected numeric(14,2),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_plan_transfer_nonnegative CHECK (transfer_expected IS NULL OR transfer_expected >= 0)
);
CREATE TABLE IF NOT EXISTS public.order_payment_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 method text NOT NULL CHECK (method IN ('efectivo','transferencia')),
 amount numeric(14,2) NOT NULL CHECK (amount > 0),
 movement_type text NOT NULL CHECK (movement_type IN ('receipt','reversal','refund')),
 source text NOT NULL CHECK (source IN ('admin','counter','driver')),
 assignment_id uuid REFERENCES public.delivery_assignments(id) ON DELETE RESTRICT,
 reversed_payment_id uuid REFERENCES public.order_payment_movements(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 note text,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payment_reversal_source CHECK ((movement_type='reversal') = (reversed_payment_id IS NOT NULL)),
 CONSTRAINT payment_driver_source CHECK (source <> 'driver' OR (assignment_id IS NOT NULL AND method='efectivo' AND movement_type='receipt'))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_reversal_per_payment
 ON public.order_payment_movements(reversed_payment_id) WHERE reversed_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS one_cash_receipt_per_assignment
 ON public.order_payment_movements(assignment_id) WHERE source='driver' AND movement_type='receipt';
CREATE INDEX IF NOT EXISTS payment_movements_order_confirmed_idx
 ON public.order_payment_movements(order_id,confirmed_at);
CREATE INDEX IF NOT EXISTS payment_movements_confirmation_method_idx
 ON public.order_payment_movements(confirmed_at,method);

CREATE TABLE IF NOT EXISTS public.order_payment_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 assignment_id uuid REFERENCES public.delivery_assignments(id) ON DELETE SET NULL,
 reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 details text NOT NULL CHECK(length(btrim(details)) BETWEEN 8 AND 300),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
 resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 resolved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_payment_issues_by_order ON public.order_payment_issues(order_id,status);

ALTER TABLE public.order_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_payment_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_payment_plans,public.order_payment_movements,public.order_payment_issues FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.order_payment_plans,public.order_payment_movements,public.order_payment_issues TO authenticated;

DROP POLICY IF EXISTS order_payment_plan_admin_read ON public.order_payment_plans;
CREATE POLICY order_payment_plan_admin_read ON public.order_payment_plans
 FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
DROP POLICY IF EXISTS order_payment_movements_admin_read ON public.order_payment_movements;
CREATE POLICY order_payment_movements_admin_read ON public.order_payment_movements
 FOR SELECT TO authenticated USING ((SELECT private.is_admin()));
DROP POLICY IF EXISTS order_payment_issues_admin_read ON public.order_payment_issues;
CREATE POLICY order_payment_issues_admin_read ON public.order_payment_issues
 FOR SELECT TO authenticated USING ((SELECT private.is_admin()));

CREATE OR REPLACE FUNCTION private.payment_received(target_order uuid, target_method text DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT COALESCE(SUM(CASE WHEN m.movement_type='receipt' THEN m.amount ELSE -m.amount END),0)::numeric
 FROM public.order_payment_movements m
 WHERE m.order_id=target_order AND (target_method IS NULL OR m.method=target_method);
$fn$;

CREATE OR REPLACE FUNCTION private.payment_driver_cash(target_assignment uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT COALESCE(SUM(CASE WHEN m.movement_type='receipt' THEN m.amount ELSE -m.amount END),0)::numeric
 FROM public.order_payment_movements m WHERE m.assignment_id=target_assignment;
$fn$;

CREATE OR REPLACE FUNCTION private.payment_cash_to_collect(target_order uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 o public.orders%ROWTYPE;
 expected numeric;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=target_order;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT o.payment_tracking_enabled THEN
   RETURN CASE WHEN o.payment_method='efectivo' THEN o.total ELSE 0 END;
 END IF;
 SELECT transfer_expected INTO expected FROM public.order_payment_plans WHERE order_id=target_order;
 IF expected IS NULL OR private.payment_received(target_order,'transferencia') < expected THEN
   RETURN NULL;
 END IF;
 RETURN GREATEST(0,o.total - private.payment_received(target_order));
END;
$fn$;

-- Nunca inferir el cobro real a partir del método histórico.
CREATE OR REPLACE FUNCTION private.payment_cash_for_settlement(target_assignment uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $fn$
 SELECT CASE WHEN o.payment_tracking_enabled
   THEN private.payment_driver_cash(da.id)
   ELSE CASE WHEN o.payment_method='efectivo' THEN o.total ELSE 0 END END
 FROM public.delivery_assignments da JOIN public.orders o ON o.id=da.order_id
 WHERE da.id=target_assignment;
$fn$;

CREATE OR REPLACE FUNCTION public.initialize_order_payment_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF NEW.payment_tracking_enabled THEN
   INSERT INTO public.order_payment_plans(order_id,transfer_expected)
   VALUES(NEW.id,CASE COALESCE(NEW.payment_preference,NEW.payment_method::text)
      WHEN 'efectivo' THEN 0
      WHEN 'transferencia' THEN NEW.total
      ELSE NULL END)
   ON CONFLICT (order_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.initialize_order_payment_plan() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS initialize_order_payment_plan ON public.orders;
CREATE TRIGGER initialize_order_payment_plan AFTER INSERT ON public.orders
 FOR EACH ROW EXECUTE FUNCTION public.initialize_order_payment_plan();

CREATE OR REPLACE FUNCTION public.admin_order_payment_detail(target_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE
 result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN
   RAISE EXCEPTION 'No autorizado.' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object(
   'orderId',o.id,'orderCode',o.order_code,'total',o.total,'status',o.status,
   'deliveryMethod',o.delivery_method,'trackingEnabled',o.payment_tracking_enabled,
   'preference',COALESCE(o.payment_preference,o.payment_method::text),
   'transferExpected',p.transfer_expected,
   'transferConfirmed',private.payment_received(o.id,'transferencia'),
   'cashConfirmed',private.payment_received(o.id,'efectivo'),
   'remaining',o.total-private.payment_received(o.id),
   'requiresRefund',o.status='cancelado' AND private.payment_received(o.id)>0,
   'movements',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',m.id,'method',m.method,'amount',m.amount,
        'movementType',m.movement_type,'source',m.source,'confirmedAt',m.confirmed_at,
        'actorId',m.actor_id,'note',m.note,'assignmentId',m.assignment_id,
        'reversedPaymentId',m.reversed_payment_id) ORDER BY m.confirmed_at DESC,m.id DESC)
      FROM public.order_payment_movements m WHERE m.order_id=o.id
   ),'[]'::jsonb),
   'issues',COALESCE((
     SELECT jsonb_agg(jsonb_build_object('id',i.id,'details',i.details,'status',i.status,
        'createdAt',i.created_at) ORDER BY i.created_at DESC)
     FROM public.order_payment_issues i WHERE i.order_id=o.id
   ),'[]'::jsonb)
 ) INTO result FROM public.orders o
 LEFT JOIN public.order_payment_plans p ON p.order_id=o.id
 WHERE o.id=target_order_id;
 IF result IS NULL THEN RAISE EXCEPTION 'Pedido no encontrado.' USING ERRCODE='22023'; END IF;
 RETURN result;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_order_payment_detail(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_order_payment_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_order_payment_plan(target_order_id uuid, transfer_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE o public.orders%ROWTYPE; cash_received numeric; transfer_received numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=target_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado.' USING ERRCODE='22023'; END IF;
 IF o.status IN ('cancelado','entregado') THEN RAISE EXCEPTION 'No se puede cambiar el plan de un pedido finalizado.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.delivery_assignments da
   WHERE da.order_id=o.id AND da.status IN ('picked_up','in_transit','delivered'))
 THEN RAISE EXCEPTION 'El reparto ya está en curso; no podés cambiar el desglose.' USING ERRCODE='22023'; END IF;
 IF transfer_amount IS NULL OR transfer_amount<0 OR transfer_amount>o.total
    OR transfer_amount<>ROUND(transfer_amount,2) THEN
   RAISE EXCEPTION 'El importe de transferencia debe estar entre cero y el total del pedido.' USING ERRCODE='22023';
 END IF;
 transfer_received:=private.payment_received(o.id,'transferencia');
 cash_received:=private.payment_received(o.id,'efectivo');
 IF transfer_received>transfer_amount OR cash_received>o.total-transfer_amount THEN
   RAISE EXCEPTION 'El nuevo desglose contradice cobros que ya fueron confirmados.' USING ERRCODE='22023';
 END IF;
 IF NOT o.payment_tracking_enabled THEN
   UPDATE public.orders SET payment_tracking_enabled=true WHERE id=o.id;
 END IF;
 INSERT INTO public.order_payment_plans(order_id,transfer_expected,updated_by,updated_at)
 VALUES(o.id,transfer_amount,auth.uid(),now())
 ON CONFLICT (order_id) DO UPDATE
 SET transfer_expected=excluded.transfer_expected,updated_by=excluded.updated_by,updated_at=now();
 RETURN public.admin_order_payment_detail(o.id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_set_order_payment_plan(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_order_payment_plan(uuid,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_register_order_payment(
 target_order_id uuid,payment_method text,payment_amount numeric,request_token uuid,
 payment_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE o public.orders%ROWTYPE; current_net numeric; id_new uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF payment_method NOT IN ('efectivo','transferencia') OR payment_amount IS NULL
    OR payment_amount<=0 OR payment_amount<>ROUND(payment_amount,2) OR request_token IS NULL THEN
   RAISE EXCEPTION 'El medio o importe del cobro no es válido.' USING ERRCODE='22023';
 END IF;
 SELECT * INTO o FROM public.orders WHERE id=target_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido no encontrado.' USING ERRCODE='22023'; END IF;
 IF o.status='cancelado' THEN RAISE EXCEPTION 'No se puede cobrar un pedido cancelado.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.order_payment_movements m WHERE m.request_id=request_token) THEN
   IF EXISTS(SELECT 1 FROM public.order_payment_movements m
     WHERE m.request_id=request_token AND m.order_id=o.id AND m.amount=payment_amount AND m.method=payment_method
     AND m.movement_type='receipt') THEN RETURN public.admin_order_payment_detail(o.id); END IF;
   RAISE EXCEPTION 'Esta operación ya fue utilizada en otro cobro.' USING ERRCODE='22023';
 END IF;
 current_net:=private.payment_received(o.id);
 IF current_net+payment_amount>o.total THEN
   RAISE EXCEPTION 'El cobro supera el saldo pendiente del pedido.' USING ERRCODE='22023';
 END IF;
 IF payment_method='efectivo' AND o.delivery_method='delivery'
   AND EXISTS(SELECT 1 FROM public.delivery_assignments da WHERE da.order_id=o.id
      AND da.status IN ('assigned','accepted','picked_up','in_transit'))
 THEN RAISE EXCEPTION 'El efectivo del reparto debe confirmarlo el repartidor al entregar.' USING ERRCODE='22023';
 END IF;
 IF NOT o.payment_tracking_enabled THEN
   UPDATE public.orders SET payment_tracking_enabled=true WHERE id=o.id;
   INSERT INTO public.order_payment_plans(order_id,transfer_expected,updated_by)
   VALUES(o.id,CASE WHEN o.payment_method='transferencia' THEN o.total ELSE 0 END,auth.uid())
   ON CONFLICT (order_id) DO NOTHING;
 END IF;
 INSERT INTO public.order_payment_movements(order_id,method,amount,movement_type,source,
    actor_id,request_id,note)
 VALUES(o.id,payment_method,payment_amount,'receipt',
    CASE WHEN o.source='admin' THEN 'counter' ELSE 'admin' END,
    auth.uid(),request_token,NULLIF(left(btrim(COALESCE(payment_note,'')),300),''))
 RETURNING id INTO id_new;
 RETURN public.admin_order_payment_detail(o.id);
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_register_order_payment(uuid,text,numeric,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_register_order_payment(uuid,text,numeric,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reverse_order_payment(
 target_payment_id uuid,reason text,request_token uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE p public.order_payment_movements%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
 IF length(btrim(COALESCE(reason,'')))<8 OR request_token IS NULL THEN
   RAISE EXCEPTION 'Indicá un motivo de al menos 8 caracteres.' USING ERRCODE='22023';
 END IF;
 SELECT * INTO p FROM public.order_payment_movements WHERE id=target_payment_id;
 IF NOT FOUND OR p.movement_type<>'receipt' THEN RAISE EXCEPTION 'Cobro original no encontrado.' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p.order_id FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.delivery_settlement_items di
    JOIN public.delivery_settlements ds ON ds.id=di.settlement_id
    WHERE di.assignment_id=p.assignment_id AND ds.status='paid')
 THEN RAISE EXCEPTION 'El cobro forma parte de una rendición ya liquidada. Registrá un ajuste autorizado.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.order_payment_movements m WHERE m.reversed_payment_id=p.id)
 THEN RAISE EXCEPTION 'Este cobro ya fue revertido.' USING ERRCODE='22023'; END IF;
 IF EXISTS (SELECT 1 FROM public.order_payment_movements m WHERE m.request_id=request_token)
 THEN RETURN public.admin_order_payment_detail(o.id); END IF;
 INSERT INTO public.order_payment_movements(order_id,method,amount,movement_type,source,
    assignment_id,reversed_payment_id,request_id,actor_id,note)
 VALUES(p.order_id,p.method,p.amount,
   CASE WHEN o.status='cancelado' THEN 'refund' ELSE 'reversal' END,
   'admin',p.assignment_id,p.id,request_token,auth.uid(),left(btrim(reason),300));
 RETURN public.admin_order_payment_detail(o.id);
END;
$fn$;
-- Allow refund movement to reference original receipt, just like a reversal.
ALTER TABLE public.order_payment_movements DROP CONSTRAINT IF EXISTS payment_reversal_source;
ALTER TABLE public.order_payment_movements ADD CONSTRAINT payment_reversal_source
 CHECK ((movement_type IN ('reversal','refund')) = (reversed_payment_id IS NOT NULL));
REVOKE ALL ON FUNCTION public.admin_reverse_order_payment(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reverse_order_payment(uuid,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_report_payment_issue(
 target_assignment_id uuid,details text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE driver uuid:=private.current_delivery_driver_id(); target_order uuid;
BEGIN
 IF driver IS NULL THEN RAISE EXCEPTION 'No autorizado.' USING ERRCODE='42501'; END IF;
 IF length(btrim(COALESCE(details,''))) NOT BETWEEN 8 AND 300 THEN
   RAISE EXCEPTION 'Contanos qué pasó (mínimo 8 caracteres).' USING ERRCODE='22023';
 END IF;
 SELECT da.order_id INTO target_order FROM public.delivery_assignments da
 JOIN public.delivery_driver_rates r ON r.id=da.rate_id
 WHERE da.id=target_assignment_id AND r.driver_id=driver
   AND da.status IN ('accepted','picked_up','in_transit');
 IF target_order IS NULL THEN RAISE EXCEPTION 'Reparto no disponible.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.order_payment_issues(order_id,assignment_id,reported_by,details)
 VALUES(target_order,target_assignment_id,driver,left(btrim(details),300));
END;
$fn$;
REVOKE ALL ON FUNCTION public.driver_report_payment_issue(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.driver_report_payment_issue(uuid,text) TO authenticated;

COMMENT ON TABLE public.order_payment_movements IS 'Cobros confirmados auditables; no se infieren a partir de preferencias históricas.';
COMMENT ON COLUMN public.orders.payment_tracking_enabled IS 'TRUE únicamente cuando el pedido registra cobros reales; registros anteriores no se reinterpretan.';
NOTIFY pgrst,'reload schema';
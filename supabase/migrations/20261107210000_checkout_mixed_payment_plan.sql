-- Checkout payment preference: atomic order creation + planned split; never a confirmed payment.
-- Apply AFTER unified payment foundation migration, on isolated test database first.
create or replace function public.create_public_order_with_payment_plan(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  result jsonb;
  requested_preference text := payload ->> 'paymentPreference';
  transfer_value numeric(12,2);
  order_total numeric(12,2);
  order_id uuid;
begin
  -- EXECUTE is granted only to service_role, the server-side caller.
  if requested_preference is distinct from 'combinado' then
    raise exception 'Preferencia de pago inválida.' using errcode = '22023';
  end if;
  if payload ->> 'paymentMethod' <> 'efectivo' then
    raise exception 'Método de compatibilidad inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.payment_methods where code = 'efectivo' and active)
     or not exists (select 1 from public.payment_methods where code = 'transferencia' and active) then
    raise exception 'Ambos medios de pago deben estar habilitados.' using errcode = '22023';
  end if;
  if jsonb_typeof(payload -> 'transferAmount') <> 'number' then
    raise exception 'Ingresá el importe de transferencia.' using errcode = '22023';
  end if;
  transfer_value := (payload ->> 'transferAmount')::numeric;
  if transfer_value <= 0 or transfer_value > 9999999999.99
     or transfer_value <> round(transfer_value,2) then
    raise exception 'El importe de transferencia debe ser válido.' using errcode = '22023';
  end if;
  -- Existing order creator validates delivery, products, business hours and reprices cart.
  -- If any later validation fails, the entire transaction rolls back.
  result := public.create_public_order_from_route(payload);
  order_id := (result ->> 'id')::uuid;
  select total into order_total from public.orders where id = order_id for update;
  if order_total is null or transfer_value >= order_total then
    raise exception 'La transferencia debe ser menor que el total actualizado del pedido.' using errcode = '22023';
  end if;
  update public.orders set payment_preference = 'combinado' where id = order_id;
  insert into public.order_payment_plans(order_id, transfer_amount, cash_amount)
  values (order_id,transfer_value,order_total-transfer_value);
  return result || jsonb_build_object(
    'paymentPreference','combinado',
    'paymentPlan',jsonb_build_object('transfer',transfer_value,'cash',order_total-transfer_value)
  );
end $fn$;
revoke all on function public.create_public_order_with_payment_plan(jsonb) from public, anon, authenticated;
grant execute on function public.create_public_order_with_payment_plan(jsonb) to service_role;

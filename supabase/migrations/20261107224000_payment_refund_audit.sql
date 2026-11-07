-- Audited full refunds of verified receipts. Never refund presumed or historical money.
create unique index if not exists order_payment_one_adjustment_idx
on public.order_payment_movements(related_movement_id)
where kind in ('reversal','refund');

create or replace function public.admin_refund_order_payment(
  target_movement_id uuid,
  refund_reason text,
  request_key uuid
) returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  original public.order_payment_movements%rowtype;
  previous public.order_payment_movements%rowtype;
  refund_id uuid;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'No tenés permisos para registrar reintegros.' using errcode='42501';
  end if;
  if request_key is null or length(btrim(coalesce(refund_reason,''))) < 8 then
    raise exception 'Indicá el motivo del reintegro (mínimo 8 caracteres).' using errcode='22023';
  end if;
  select * into original from public.order_payment_movements
  where id=target_movement_id;
  if not found then raise exception 'No encontramos el cobro.' using errcode='22023'; end if;
  perform 1 from public.orders where id=original.order_id for update;
  select * into previous from public.order_payment_movements where idempotency_key=request_key;
  if found then
    if previous.kind <> 'refund' or previous.related_movement_id <> target_movement_id then
      raise exception 'Esa clave ya se utilizó en otro movimiento.' using errcode='22023';
    end if;
    return jsonb_build_object('movementId',previous.id,'repeated',true);
  end if;
  if original.kind <> 'payment' or original.source='delivery' then
    raise exception 'Ese movimiento necesita una revisión especial de liquidación.' using errcode='22023';
  end if;
  if exists(select 1 from public.delivery_assignments da
    where da.order_id=original.order_id
      and da.status not in ('cancelled','rejected_by_customer')) then
    raise exception 'No se permite reintegrar dinero de una entrega activa o rendida.' using errcode='22023';
  end if;
  if exists(select 1 from public.order_payment_movements
    where related_movement_id=target_movement_id and kind in ('reversal','refund')) then
    raise exception 'Este cobro ya fue revertido o reintegrado.' using errcode='22023';
  end if;
  insert into public.order_payment_movements (
    order_id,method,amount,kind,source,idempotency_key,confirmed_by,
    related_movement_id,reason
  ) values (
    original.order_id,original.method,original.amount,'refund','admin',
    request_key,auth.uid(),original.id,btrim(refund_reason)
  ) returning id into refund_id;
  return jsonb_build_object('movementId',refund_id,'repeated',false);
end $fn$;
revoke all on function public.admin_refund_order_payment(uuid,text,uuid) from public, anon;
grant execute on function public.admin_refund_order_payment(uuid,text,uuid) to authenticated;

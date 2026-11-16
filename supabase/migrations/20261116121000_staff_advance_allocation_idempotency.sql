-- Dev: evitar doble aplicación de anticipos por reintentos de red.
alter table public.staff_advance_allocations add column request_key uuid;
update public.staff_advance_allocations set request_key=gen_random_uuid() where request_key is null;
alter table public.staff_advance_allocations alter column request_key set not null;
create unique index staff_advance_allocations_request_key on public.staff_advance_allocations(request_key);
drop function public.admin_staff_apply_advance(uuid,uuid,numeric);

create or replace function public.admin_staff_apply_advance(advance_uuid uuid, payroll_uuid uuid, allocation_value numeric, request_uuid uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_advance public.staff_payments%rowtype; v_owner uuid; v_left numeric; v_due numeric; v_id uuid; v_existing public.staff_advance_allocations%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if request_uuid is null then raise exception 'Falta la clave de idempotencia'; end if;
 select * into v_existing from public.staff_advance_allocations where request_key=request_uuid;
 if found then
  if v_existing.advance_id is distinct from advance_uuid
    or v_existing.payroll_id is distinct from payroll_uuid
    or v_existing.amount is distinct from allocation_value then
    raise exception 'Clave de idempotencia utilizada para otra aplicación';
  end if;
  return v_existing.id;
 end if;
 if allocation_value is null or allocation_value<=0 or allocation_value<>round(allocation_value,2) then raise exception 'Importe inválido'; end if;
 select * into v_advance from public.staff_payments where id=advance_uuid for update;
 if not found or v_advance.payment_kind<>'advance' or v_advance.reversed_at is not null then raise exception 'Anticipo inválido'; end if;
 select employee_id into v_owner from public.staff_payrolls where id=payroll_uuid for update;
 if v_owner is distinct from v_advance.employee_id then raise exception 'El anticipo pertenece a otro empleado'; end if;
 select v_advance.amount-coalesce(sum(amount),0) into v_left from public.staff_advance_allocations
 where advance_id=advance_uuid and reversed_at is null;
 select (select coalesce(sum(rate_amount_snapshot),0) from public.staff_payroll_lines where payroll_id=payroll_uuid)
   -(select coalesce(sum(amount),0) from public.staff_payments where payroll_id=payroll_uuid and reversed_at is null)
   -(select coalesce(sum(amount),0) from public.staff_advance_allocations where payroll_id=payroll_uuid and reversed_at is null)
 into v_due;
 if allocation_value>round(least(v_left,v_due),2) then raise exception 'El importe supera el anticipo disponible o el saldo'; end if;
 insert into public.staff_advance_allocations(advance_id,payroll_id,amount,created_by,request_key)
 values(advance_uuid,payroll_uuid,allocation_value,auth.uid(),request_uuid) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.admin_staff_apply_advance(uuid,uuid,numeric,uuid) from public,anon,authenticated;
grant execute on function public.admin_staff_apply_advance(uuid,uuid,numeric,uuid) to authenticated;

-- Endurecimiento de precisión e idempotencia para pagos de empleados V1 (solo dev).
create or replace function public.admin_staff_add_rate(employee_uuid uuid, valid_from date, weekday_value numeric, saturday_value numeric, sunday_value numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.staff_employees where id=employee_uuid and active) then
  raise exception 'Seleccioná un empleado activo';
 end if;
 if valid_from is null or weekday_value is null or saturday_value is null or sunday_value is null
   or least(weekday_value,saturday_value,sunday_value)<0
   or weekday_value<>round(weekday_value,2) or saturday_value<>round(saturday_value,2)
   or sunday_value<>round(sunday_value,2) then raise exception 'Tarifas inválidas'; end if;
 insert into public.staff_pay_rates(employee_id,effective_from,weekday_rate,saturday_rate,sunday_rate,created_by)
 values(employee_uuid,valid_from,weekday_value,saturday_value,sunday_value,auth.uid())
 returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'Ya existe una tarifa con esa fecha de inicio';
end $$;

create or replace function public.admin_staff_record_payment(employee_uuid uuid, payroll_uuid uuid, payment_value numeric, payment_day date, payment_type text, payment_notes text, request_uuid uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_total numeric; v_paid numeric; v_applied numeric; v_owner uuid; v_existing public.staff_payments%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if request_uuid is null then raise exception 'Falta la clave de idempotencia'; end if;
 select * into v_existing from public.staff_payments where request_key=request_uuid;
 if found then
   if v_existing.employee_id is distinct from employee_uuid
      or v_existing.payroll_id is distinct from payroll_uuid
      or v_existing.amount is distinct from payment_value
      or v_existing.paid_on is distinct from payment_day
      or v_existing.payment_kind is distinct from payment_type then
      raise exception 'Clave de idempotencia utilizada para otro movimiento';
   end if;
   return v_existing.id;
 end if;
 if payment_value is null or payment_value<=0 or payment_value<>round(payment_value,2) or payment_day is null or payment_type not in ('advance','payroll') then raise exception 'Pago inválido'; end if;
 perform 1 from public.staff_employees where id=employee_uuid for update;
 if not found then raise exception 'Empleado inexistente'; end if;
 if payment_type='advance' and payroll_uuid is not null then raise exception 'El anticipo no se vincula a una liquidación al registrarlo'; end if;
 if payment_type='payroll' then
   select employee_id into v_owner from public.staff_payrolls where id=payroll_uuid for update;
   if v_owner is distinct from employee_uuid then raise exception 'Liquidación incorrecta'; end if;
   select coalesce(sum(rate_amount_snapshot),0) into v_total from public.staff_payroll_lines where payroll_id=payroll_uuid;
   select coalesce(sum(amount),0) into v_paid from public.staff_payments where payroll_id=payroll_uuid and reversed_at is null;
   select coalesce(sum(amount),0) into v_applied from public.staff_advance_allocations where payroll_id=payroll_uuid and reversed_at is null;
   if payment_value>round(v_total-v_paid-v_applied,2) then raise exception 'El importe supera el saldo de la liquidación'; end if;
 end if;
 insert into public.staff_payments(employee_id,payroll_id,payment_kind,amount,paid_on,notes,request_key,created_by)
 values(employee_uuid,payroll_uuid,payment_type,payment_value,payment_day,nullif(trim(coalesce(payment_notes,'')),''),request_uuid,auth.uid())
 returning id into v_id;
 return v_id;
exception when unique_violation then
 select * into v_existing from public.staff_payments where request_key=request_uuid;
 if v_existing.id is null then raise; end if;
 if v_existing.employee_id is distinct from employee_uuid
    or v_existing.payroll_id is distinct from payroll_uuid
    or v_existing.amount is distinct from payment_value
    or v_existing.paid_on is distinct from payment_day
    or v_existing.payment_kind is distinct from payment_type then
   raise exception 'Clave de idempotencia utilizada para otro movimiento';
 end if;
 return v_existing.id;
end $$;

create or replace function public.admin_staff_apply_advance(advance_uuid uuid, payroll_uuid uuid, allocation_value numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_advance public.staff_payments%rowtype; v_owner uuid; v_left numeric; v_due numeric; v_id uuid;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
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
 insert into public.staff_advance_allocations(advance_id,payroll_id,amount,created_by)
 values(advance_uuid,payroll_uuid,allocation_value,auth.uid()) returning id into v_id;
 return v_id;
end $$;

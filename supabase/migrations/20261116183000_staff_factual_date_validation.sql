-- Payroll V1: validate factual dates against Argentina business day; does not mutate existing history.

CREATE OR REPLACE FUNCTION public.admin_staff_approve_attendance(attendance_uuid uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_a public.staff_attendance%rowtype; v_rate public.staff_pay_rates%rowtype; v_amount numeric(14,2);
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 select * into v_a from public.staff_attendance where id=attendance_uuid for update;
 if not found then raise exception 'Asistencia inexistente'; end if;
 if v_a.work_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'No se puede aprobar una asistencia de una fecha futura'; end if;
 if exists(select 1 from public.staff_payroll_lines where attendance_id=attendance_uuid) then raise exception 'Ya está liquidada'; end if;
 if v_a.approval_status='approved' then return v_a.amount_snapshot; end if;
 if v_a.attendance_kind='absent' then
   v_amount:=0;
 else
   select * into v_rate from public.staff_pay_rates
   where employee_id=v_a.employee_id and effective_from<=v_a.work_date
   order by effective_from desc limit 1;
   if not found then raise exception 'Configurá una tarifa vigente para esa fecha'; end if;
   v_amount:=case extract(isodow from v_a.work_date)
      when 6 then v_rate.saturday_rate
      when 7 then v_rate.sunday_rate
      else v_rate.weekday_rate end;
 end if;
 update public.staff_attendance set approval_status='approved',
    rate_id=case when v_a.attendance_kind='present' then v_rate.id else null end,
    amount_snapshot=v_amount,approved_at=now(),approved_by=auth.uid(),updated_at=now()
 where id=attendance_uuid;
 return v_amount;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_staff_create_payroll(employee_uuid uuid, from_day date, to_day date, payroll_notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_count integer;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if to_day > (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'No se puede liquidar un período que termina después de hoy'; end if;
 if from_day is null or to_day is null or to_day<from_day or to_day-from_day>92 then
   raise exception 'Período inválido (máximo 93 días)'; end if;
 perform 1 from public.staff_employees where id=employee_uuid for update;
 if not found then raise exception 'Empleado inexistente'; end if;
 if exists(select 1 from public.staff_payrolls p where p.employee_id=employee_uuid and p.period_from<=to_day and p.period_to>=from_day) then
  raise exception 'Ya existe una liquidación que se solapa con el período'; end if;
 if exists(select 1 from public.staff_attendance a where a.employee_id=employee_uuid and a.work_date between from_day and to_day and a.approval_status='pending') then
   raise exception 'Hay asistencias pendientes de aprobación'; end if;
 select count(*) into v_count from public.staff_attendance a
 where a.employee_id=employee_uuid and a.work_date between from_day and to_day and a.approval_status='approved'
 and not exists(select 1 from public.staff_payroll_lines l where l.attendance_id=a.id);
 if v_count=0 then raise exception 'No hay asistencias aprobadas para liquidar'; end if;
 insert into public.staff_payrolls(employee_id,period_from,period_to,posted_by,notes)
 values(employee_uuid,from_day,to_day,auth.uid(),nullif(trim(coalesce(payroll_notes,'')),'')) returning id into v_id;
 insert into public.staff_payroll_lines(payroll_id,attendance_id,rate_amount_snapshot)
 select v_id,a.id,a.amount_snapshot from public.staff_attendance a
 where a.employee_id=employee_uuid and a.work_date between from_day and to_day and a.approval_status='approved'
 and not exists(select 1 from public.staff_payroll_lines l where l.attendance_id=a.id);
 return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_staff_record_payment(employee_uuid uuid, payroll_uuid uuid, payment_value numeric, payment_day date, payment_type text, payment_notes text, request_uuid uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_total numeric; v_paid numeric; v_applied numeric; v_owner uuid; v_existing public.staff_payments%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if payment_day > (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'No se puede registrar un pago con fecha futura'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.admin_staff_save_attendance(employee_uuid uuid, attendance_day date, attendance_value text, attendance_notes text, correction_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid; v_old public.staff_attendance%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if attendance_value not in ('present','absent') or attendance_day is null then raise exception 'Asistencia inválida'; end if;
 if attendance_day > (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'No se puede registrar una asistencia posterior a hoy'; end if;
 if not exists(select 1 from public.staff_employees where id=employee_uuid and active) then raise exception 'Empleado inactivo o inexistente'; end if;
 select * into v_old from public.staff_attendance where employee_id=employee_uuid and work_date=attendance_day for update;
 if found then
  if exists(select 1 from public.staff_payroll_lines where attendance_id=v_old.id) then raise exception 'Asistencia liquidada: no puede modificarse'; end if;
  if v_old.approval_status='approved' and length(trim(coalesce(correction_reason,'')))<5 then
    raise exception 'Ingresá un motivo de corrección (mínimo 5 caracteres)';
  end if;
  if v_old.approval_status='approved' then
    insert into public.staff_attendance_corrections(attendance_id,previous_kind,previous_notes,previous_amount,reason,changed_by)
    values(v_old.id,v_old.attendance_kind,v_old.notes,v_old.amount_snapshot,trim(correction_reason),auth.uid());
  end if;
  update public.staff_attendance
  set attendance_kind=attendance_value,notes=nullif(trim(coalesce(attendance_notes,'')),''),
      approval_status='pending',rate_id=null,amount_snapshot=null,approved_at=null,approved_by=null,updated_at=now()
  where id=v_old.id returning id into v_id;
 else
  insert into public.staff_attendance(employee_id,work_date,attendance_kind,notes)
  values(employee_uuid,attendance_day,attendance_value,nullif(trim(coalesce(attendance_notes,'')),''))
  returning id into v_id;
 end if;
 return v_id;
end $function$;

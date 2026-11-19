-- Prevent late attendance additions or edits inside already posted payroll periods.
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
 if exists(select 1 from public.staff_payrolls where employee_id=employee_uuid and period_from<=attendance_day and period_to>=attendance_day) then
  raise exception 'El día pertenece a un período ya liquidado. No se pueden registrar nuevas asistencias';
 end if;
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

-- V2 staff operations. All financial/attendance records remain in existing tables.
-- Safe, atomic bulk operations: any failure rolls the whole call back.

create or replace function public.admin_staff_save_week(jsonb_changes jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  v_employee uuid;
  v_day date;
  v_kind text;
  v_expected uuid;
  v_existing public.staff_attendance%rowtype;
  v_count integer := 0;
  v_first date;
begin
  if not private.is_admin() then raise exception 'No autorizado'; end if;
  if jsonb_typeof(jsonb_changes) <> 'array'
     or jsonb_array_length(jsonb_changes) not between 1 and 140 then
    raise exception 'Seleccioná entre 1 y 140 cambios de asistencia'; end if;

  for item in select value from jsonb_array_elements(jsonb_changes)
  loop
    v_employee := (item->>'employee_id')::uuid;
    v_day := (item->>'day')::date;
    v_kind := item->>'kind';
    v_expected := nullif(item->>'expected_id','')::uuid;
    if v_employee is null or v_day is null or v_kind not in ('present','absent') or v_kind is null then
      raise exception 'Registro de asistencia inválido'; end if;
    if v_day > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
      raise exception 'No se pueden registrar asistencias futuras'; end if;
    if v_first is null then v_first := date_trunc('week',v_day::timestamp)::date; end if;
    if v_day < v_first or v_day > v_first+6 then
      raise exception 'Todos los cambios deben pertenecer a la misma semana'; end if;

    -- Stable lock and stale snapshot detection; never alter approved/settled records.
    perform 1 from public.staff_employees where id=v_employee and active for update;
    if not found then raise exception 'Empleado inactivo o inexistente'; end if;
    select * into v_existing from public.staff_attendance
      where employee_id=v_employee and work_date=v_day for update;
    if v_expected is distinct from v_existing.id then
      raise exception 'Las asistencias cambiaron. Actualizá la pantalla antes de guardar'; end if;
    if found and v_existing.approval_status='approved' then
      raise exception 'No se puede modificar una asistencia aprobada desde la grilla'; end if;
    if found and exists(select 1 from public.staff_payroll_lines where attendance_id=v_existing.id) then
      raise exception 'Una asistencia ya fue liquidada'; end if;
    -- Reject duplicate input day/employee, even though the underlying table is unique.
    if exists (
      select 1 from jsonb_array_elements(jsonb_changes) other
      where other <> item and other->>'employee_id'=item->>'employee_id'
      and other->>'day'=item->>'day'
    ) then raise exception 'Hay días de asistencia repetidos'; end if;
    perform public.admin_staff_save_attendance(
      v_employee, v_day, v_kind, coalesce(v_existing.notes, ''), null
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create or replace function public.admin_staff_create_payroll_batch(
  employee_uuids uuid[], from_day date, to_day date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_employee uuid;
  v_payroll uuid;
  v_results jsonb := '[]'::jsonb;
begin
  if not private.is_admin() then raise exception 'No autorizado'; end if;
  if employee_uuids is null or array_length(employee_uuids,1) not between 1 and 50 then
    raise exception 'Seleccioná entre 1 y 50 empleados'; end if;
  if from_day is null or to_day is null or to_day < from_day
     or to_day > (now() at time zone 'America/Argentina/Buenos_Aires')::date
     or to_day-from_day>92 then raise exception 'Período de liquidación inválido'; end if;
  if (select count(distinct x) from unnest(employee_uuids) x) <> array_length(employee_uuids,1)
    or array_position(employee_uuids,null) is not null then
    raise exception 'La selección contiene empleados repetidos o inválidos'; end if;
  for v_employee in select unnest(employee_uuids) order by 1
  loop
    v_payroll := public.admin_staff_create_payroll(v_employee,from_day,to_day,'Liquidación por lote');
    v_results := v_results || jsonb_build_array(
      jsonb_build_object('employee_id',v_employee,'payroll_id',v_payroll));
  end loop;
  return v_results;
end $$;

revoke all on function public.admin_staff_save_week(jsonb) from public, anon;
revoke all on function public.admin_staff_create_payroll_batch(uuid[],date,date) from public, anon;
grant execute on function public.admin_staff_save_week(jsonb) to authenticated;
grant execute on function public.admin_staff_create_payroll_batch(uuid[],date,date) to authenticated;

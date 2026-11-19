-- Fix duplicate attendance items; restrict to DEV until promoted intentionally.
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

  -- Validate the entire array before touching any row. Comparing JSON values in the
  -- loop is insufficient: two byte-identical entries previously bypassed the check.
  if exists (
    select 1 from jsonb_array_elements(jsonb_changes) as entry(value)
    group by value->>'employee_id', value->>'day'
    having count(*) > 1
  ) then raise exception 'Hay días de asistencia repetidos'; end if;

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
    perform public.admin_staff_save_attendance(
      v_employee, v_day, v_kind, coalesce(v_existing.notes, ''), null
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

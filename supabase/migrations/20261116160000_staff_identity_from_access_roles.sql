-- Pago a empleados: vincular de forma automática identidades de usuarios con rol staff.
-- Aplicada exclusivamente al proyecto central-burguer-dev; NO ejecutar en producción sin autorización.
-- Mantiene los IDs de staff_employees para preservar relaciones de pagos/liquidaciones.

CREATE OR REPLACE FUNCTION private.sync_staff_employee_for_profile(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_profile public.profiles%rowtype; v_has_staff boolean; v_enabled boolean;
begin
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then return; end if;
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_profile_id and r.code = 'staff' and r.active
  ) into v_has_staff;
  v_enabled := v_has_staff and v_profile.active and v_profile.archived_at is null;
  if v_has_staff then
    insert into public.staff_employees (profile_id, full_name, active)
    values (v_profile.id, v_profile.full_name, v_enabled)
    on conflict (profile_id) do update
      set full_name = excluded.full_name, active = excluded.active,
          updated_at = now()
    where public.staff_employees.full_name is distinct from excluded.full_name
       or public.staff_employees.active is distinct from excluded.active;
  else
    update public.staff_employees
       set full_name = v_profile.full_name, active = false, updated_at = now()
     where profile_id = p_profile_id
       and (active or full_name is distinct from v_profile.full_name);
  end if;
end $function$;

CREATE OR REPLACE FUNCTION private.staff_identity_roles_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform private.sync_staff_employee_for_profile(old.user_id);
  end if;
  perform private.sync_staff_employee_for_profile(
    case when tg_op = 'DELETE' then old.user_id else new.user_id end
  );
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.staff_identity_profile_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.sync_staff_employee_for_profile(new.id);
  return null;
end $function$;

CREATE OR REPLACE FUNCTION private.staff_identity_role_definition_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if (new.code = 'staff' or old.code = 'staff')
     and (new.active is distinct from old.active or new.code is distinct from old.code) then
    for v_id in
      select user_id from public.user_roles where role_id = new.id
    loop
      perform private.sync_staff_employee_for_profile(v_id);
    end loop;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_staff_dashboard(from_day date DEFAULT NULL::date, to_day date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_from date := coalesce(from_day, (date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires'))::date);
  v_to date := coalesce(to_day, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
begin
  if not private.is_admin() then raise exception 'No autorizado'; end if;
  if v_to < v_from or v_to-v_from > 366 then raise exception 'Período inválido'; end if;
  return jsonb_build_object(
    'employees', (select coalesce(jsonb_agg(
      to_jsonb(e) || jsonb_build_object(
        'full_name', coalesce(p.full_name, e.full_name),
        'active', e.active and coalesce(p.active, false) and p.archived_at is null
      ) order by coalesce(p.full_name,e.full_name)), '[]'::jsonb)
      from public.staff_employees e left join public.profiles p on p.id = e.profile_id),
    'rates', (select coalesce(jsonb_agg(to_jsonb(r) order by r.effective_from desc), '[]'::jsonb) from public.staff_pay_rates r),
    'attendance', (select coalesce(jsonb_agg(to_jsonb(a) order by a.work_date desc), '[]'::jsonb) from public.staff_attendance a where a.work_date between v_from and v_to),
    'payrolls', (select coalesce(jsonb_agg(to_jsonb(p) order by p.posted_at desc), '[]'::jsonb) from public.staff_payrolls p),
    'lines', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.staff_payroll_lines l),
    'payments', (select coalesce(jsonb_agg(to_jsonb(m) order by m.paid_on desc), '[]'::jsonb) from public.staff_payments m),
    'allocations', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.staff_advance_allocations a),
    'corrections', (select coalesce(jsonb_agg(to_jsonb(c) order by c.changed_at desc), '[]'::jsonb)
      from (select * from public.staff_attendance_corrections order by changed_at desc limit 100) c)
  );
end $function$;

revoke all on function private.sync_staff_employee_for_profile(uuid) from public, anon, authenticated;

drop trigger if exists trg_staff_identity_profile on public.profiles;
CREATE TRIGGER trg_staff_identity_profile AFTER INSERT OR UPDATE OF full_name, active, archived_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.staff_identity_profile_changed();

drop trigger if exists trg_staff_identity_role_definition on public.roles;
CREATE TRIGGER trg_staff_identity_role_definition AFTER UPDATE OF code, active ON public.roles FOR EACH ROW EXECUTE FUNCTION private.staff_identity_role_definition_changed();

drop trigger if exists trg_staff_identity_roles on public.user_roles;
CREATE TRIGGER trg_staff_identity_roles AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION private.staff_identity_roles_changed();

-- Sincronización inicial idempotente de los usuarios con rol Personal.
do $sync$
declare v_user uuid;
begin
 for v_user in select distinct ur.user_id from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code='staff'
 loop perform private.sync_staff_employee_for_profile(v_user); end loop;
end $sync$;

-- La creación independiente de empleados queda retirada de la API autenticada.
revoke execute on function public.admin_staff_save_employee(uuid,text,text,boolean) from public,anon,authenticated;

-- La Central Burger · Personal y pagos V1 · SOLO desarrollo.
-- Diseño 3FN, valores de tarifa versionados, instantáneas en asistencia y liquidación.
-- Feriados / turnos parciales aún sin reglas comerciales: no se calculan automáticamente.

create table public.staff_employees (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid unique references public.profiles(id) on delete restrict,
 full_name text not null check (length(trim(full_name)) between 2 and 120),
 notes text,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.staff_pay_rates (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.staff_employees(id) on delete restrict,
 effective_from date not null,
 weekday_rate numeric(14,2) not null check (weekday_rate >= 0),
 saturday_rate numeric(14,2) not null check (saturday_rate >= 0),
 sunday_rate numeric(14,2) not null check (sunday_rate >= 0),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(employee_id,effective_from)
);
create index staff_rates_lookup on public.staff_pay_rates(employee_id,effective_from desc);

create table public.staff_attendance (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.staff_employees(id) on delete restrict,
 work_date date not null,
 attendance_kind text not null check (attendance_kind in ('present','absent')),
 approval_status text not null default 'pending' check (approval_status in ('pending','approved')),
 notes text,
 rate_id uuid references public.staff_pay_rates(id) on delete restrict,
 amount_snapshot numeric(14,2) check (amount_snapshot >= 0),
 approved_by uuid references public.profiles(id) on delete set null,
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(employee_id,work_date),
 check ((approval_status='pending' and rate_id is null and amount_snapshot is null and approved_at is null)
     or (approval_status='approved' and amount_snapshot is not null and approved_at is not null))
);
create index staff_attendance_period on public.staff_attendance(employee_id,work_date desc);

create table public.staff_attendance_corrections (
 id uuid primary key default gen_random_uuid(),
 attendance_id uuid not null references public.staff_attendance(id) on delete restrict,
 previous_kind text not null,
 previous_notes text,
 previous_amount numeric(14,2),
 reason text not null check (length(trim(reason)) >= 5),
 changed_by uuid references public.profiles(id) on delete set null,
 changed_at timestamptz not null default now()
);

create table public.staff_payrolls (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.staff_employees(id) on delete restrict,
 period_from date not null,
 period_to date not null,
 posted_at timestamptz not null default now(),
 posted_by uuid references public.profiles(id) on delete set null,
 notes text,
 check (period_to >= period_from),
 unique(employee_id,period_from,period_to)
);
create index staff_payroll_period on public.staff_payrolls(employee_id,period_from,period_to);

create table public.staff_payroll_lines (
 id uuid primary key default gen_random_uuid(),
 payroll_id uuid not null references public.staff_payrolls(id) on delete restrict,
 attendance_id uuid not null unique references public.staff_attendance(id) on delete restrict,
 rate_amount_snapshot numeric(14,2) not null check (rate_amount_snapshot>=0)
);
create index staff_payroll_lines_parent on public.staff_payroll_lines(payroll_id);

create table public.staff_payments (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.staff_employees(id) on delete restrict,
 payroll_id uuid references public.staff_payrolls(id) on delete restrict,
 payment_kind text not null check (payment_kind in ('advance','payroll')),
 amount numeric(14,2) not null check (amount > 0),
 paid_on date not null,
 notes text,
 request_key uuid not null unique,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 reversed_at timestamptz,
 reversed_by uuid references public.profiles(id) on delete set null,
 reversal_reason text,
 check ((payment_kind='advance' and payroll_id is null) or (payment_kind='payroll' and payroll_id is not null)),
 check ((reversed_at is null and reversed_by is null and reversal_reason is null) or (reversed_at is not null and reversal_reason is not null))
);
create index staff_payments_employee_date on public.staff_payments(employee_id,paid_on desc);
create index staff_payments_payroll on public.staff_payments(payroll_id);

create table public.staff_advance_allocations (
 id uuid primary key default gen_random_uuid(),
 advance_id uuid not null references public.staff_payments(id) on delete restrict,
 payroll_id uuid not null references public.staff_payrolls(id) on delete restrict,
 amount numeric(14,2) not null check(amount > 0),
 created_at timestamptz not null default now(),
 created_by uuid references public.profiles(id) on delete set null,
 reversed_at timestamptz,
 reversed_by uuid references public.profiles(id) on delete set null,
 reversal_reason text,
 check ((reversed_at is null and reversed_by is null and reversal_reason is null) or (reversed_at is not null and reversal_reason is not null))
);
create index staff_allocations_advance on public.staff_advance_allocations(advance_id);
create index staff_allocations_payroll on public.staff_advance_allocations(payroll_id);

-- Sin escrituras directas desde el navegador; todas las mutaciones pasan por RPC admin.
do $guard$
declare t text;
begin
 foreach t in array array['staff_employees','staff_pay_rates','staff_attendance','staff_attendance_corrections','staff_payrolls','staff_payroll_lines','staff_payments','staff_advance_allocations']
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from anon,authenticated',t);
  execute format('grant select on table public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using ((select private.is_admin()))',t||'_admin_read',t);
 end loop;
end $guard$;

-- Empleados: desactivar en lugar de borrar.
create function public.admin_staff_save_employee(employee_uuid uuid, employee_name text, employee_notes text, employee_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if length(trim(coalesce(employee_name,''))) not between 2 and 120 then raise exception 'Nombre inválido'; end if;
 if employee_uuid is null then
  insert into public.staff_employees(full_name,notes,active)
  values(trim(employee_name),nullif(trim(coalesce(employee_notes,'')),''),coalesce(employee_active,true))
  returning id into v_id;
 else
  update public.staff_employees
  set full_name=trim(employee_name),notes=nullif(trim(coalesce(employee_notes,'')),''),active=coalesce(employee_active,true),updated_at=now()
  where id=employee_uuid returning id into v_id;
  if v_id is null then raise exception 'Empleado inexistente'; end if;
 end if;
 return v_id;
end $$;

-- Nuevas versiones de tarifas: no se altera nunca una versión anterior.
create function public.admin_staff_add_rate(employee_uuid uuid, valid_from date, weekday_value numeric, saturday_value numeric, sunday_value numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.staff_employees where id=employee_uuid and active) then
  raise exception 'Seleccioná un empleado activo';
 end if;
 if valid_from is null or weekday_value is null or saturday_value is null or sunday_value is null
   or least(weekday_value,saturday_value,sunday_value)<0 then raise exception 'Tarifas inválidas'; end if;
 insert into public.staff_pay_rates(employee_id,effective_from,weekday_rate,saturday_rate,sunday_rate,created_by)
 values(employee_uuid,valid_from,weekday_value,saturday_value,sunday_value,auth.uid())
 returning id into v_id;
 return v_id;
exception when unique_violation then raise exception 'Ya existe una tarifa con esa fecha de inicio';
end $$;

-- Asistencia diaria. Si se corrige una aprobada se exige motivo y vuelve a pendiente.
create function public.admin_staff_save_attendance(employee_uuid uuid, attendance_day date, attendance_value text, attendance_notes text, correction_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.staff_attendance%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if attendance_value not in ('present','absent') or attendance_day is null then raise exception 'Asistencia inválida'; end if;
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
end $$;

create function public.admin_staff_approve_attendance(attendance_uuid uuid)
returns numeric language plpgsql security definer set search_path='' as $$
declare v_a public.staff_attendance%rowtype; v_rate public.staff_pay_rates%rowtype; v_amount numeric(14,2);
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 select * into v_a from public.staff_attendance where id=attendance_uuid for update;
 if not found then raise exception 'Asistencia inexistente'; end if;
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
end $$;

-- La liquidación congela las asistencias aprobadas (sin duplicar una jornada).
create function public.admin_staff_create_payroll(employee_uuid uuid, from_day date, to_day date, payroll_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_count integer;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
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
end $$;

-- Dinero real entregado, separado de anticipos y asignaciones a liquidaciones.
create function public.admin_staff_record_payment(employee_uuid uuid, payroll_uuid uuid, payment_value numeric, payment_day date, payment_type text, payment_notes text, request_uuid uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_total numeric; v_paid numeric; v_applied numeric; v_owner uuid;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if request_uuid is null then raise exception 'Falta la clave de idempotencia'; end if;
 select id into v_id from public.staff_payments where request_key=request_uuid;
 if found then return v_id; end if;
 if payment_value is null or payment_value<=0 or payment_day is null or payment_type not in ('advance','payroll') then raise exception 'Pago inválido'; end if;
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
 select id into v_id from public.staff_payments where request_key=request_uuid;
 if v_id is null then raise; end if;
 return v_id;
end $$;

-- Aplicar anticipos a una liquidación no crea un nuevo pago.
create function public.admin_staff_apply_advance(advance_uuid uuid, payroll_uuid uuid, allocation_value numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_advance public.staff_payments%rowtype; v_owner uuid; v_left numeric; v_due numeric; v_id uuid;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if allocation_value is null or allocation_value<=0 then raise exception 'Importe inválido'; end if;
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

create function public.admin_staff_reverse_payment(payment_uuid uuid, reverse_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_p public.staff_payments%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if length(trim(coalesce(reverse_reason,'')))<5 then raise exception 'Indicá el motivo de reversión'; end if;
 select * into v_p from public.staff_payments where id=payment_uuid for update;
 if not found or v_p.reversed_at is not null then raise exception 'Movimiento inexistente o ya revertido'; end if;
 if exists(select 1 from public.staff_advance_allocations where advance_id=payment_uuid and reversed_at is null) then
  raise exception 'Revertí primero las aplicaciones del anticipo'; end if;
 update public.staff_payments set reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(reverse_reason) where id=payment_uuid;
end $$;

create function public.admin_staff_reverse_allocation(allocation_uuid uuid, reverse_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_a public.staff_advance_allocations%rowtype;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if length(trim(coalesce(reverse_reason,'')))<5 then raise exception 'Indicá el motivo de reversión'; end if;
 select * into v_a from public.staff_advance_allocations where id=allocation_uuid for update;
 if not found or v_a.reversed_at is not null then raise exception 'Aplicación inexistente o ya revertida'; end if;
 perform 1 from public.staff_payments where id=v_a.advance_id for update;
 perform 1 from public.staff_payrolls where id=v_a.payroll_id for update;
 update public.staff_advance_allocations set reversed_at=now(),reversed_by=auth.uid(),reversal_reason=trim(reverse_reason)
 where id=allocation_uuid;
end $$;

-- Panel: un único roundtrip inicial, datos limitados por período en asistencias.
create function public.admin_staff_dashboard(from_day date default null,to_day date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_from date:=coalesce(from_day,(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'))::date);
declare v_to date:=coalesce(to_day,(now() at time zone 'America/Argentina/Buenos_Aires')::date);
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if v_to<v_from or v_to-v_from>366 then raise exception 'Período inválido'; end if;
 return jsonb_build_object(
  'employees', (select coalesce(jsonb_agg(to_jsonb(e) order by e.full_name),'[]'::jsonb) from public.staff_employees e),
  'rates',(select coalesce(jsonb_agg(to_jsonb(r) order by r.effective_from desc),'[]'::jsonb) from public.staff_pay_rates r),
  'attendance',(select coalesce(jsonb_agg(to_jsonb(a) order by a.work_date desc),'[]'::jsonb) from public.staff_attendance a where a.work_date between v_from and v_to),
  'payrolls',(select coalesce(jsonb_agg(to_jsonb(p) order by p.posted_at desc),'[]'::jsonb) from public.staff_payrolls p),
  'lines',(select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) from public.staff_payroll_lines l),
  'payments',(select coalesce(jsonb_agg(to_jsonb(m) order by m.paid_on desc),'[]'::jsonb) from public.staff_payments m),
  'allocations',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.staff_advance_allocations a),
  'corrections',(select coalesce(jsonb_agg(to_jsonb(c) order by c.changed_at desc),'[]'::jsonb) from (select * from public.staff_attendance_corrections order by changed_at desc limit 100) c)
 );
end $$;

-- EXECUTE se limita a autenticados, cada RPC vuelve a comprobar admin en base.
do $revoke$
declare func record;
begin
 for func in
  select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'admin_staff_%'
 loop
  execute format('revoke all on function %s from public,anon,authenticated',func.sig);
  execute format('grant execute on function %s to authenticated',func.sig);
 end loop;
end $revoke$;

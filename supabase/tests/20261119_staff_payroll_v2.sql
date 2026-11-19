-- Pruebas de regresión V2: no persisten cambios reales (ROLLBACK).
begin;
select set_config('request.jwt.claim.sub',(
  select ur.user_id::text from public.user_roles ur
  join public.roles r on r.id=ur.role_id and r.code='admin' limit 1
),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
 v_emp uuid;
 v_day date;
 v_att uuid;
 v_count int;
 v_payroll jsonb;
 v_failed boolean;
begin
 select e.id, d.day::date into v_emp, v_day
 from public.staff_employees e
 cross join lateral generate_series(
   (now() at time zone 'America/Argentina/Buenos_Aires')::date-1,
   (now() at time zone 'America/Argentina/Buenos_Aires')::date-365,
   interval '-1 day') d(day)
 where e.active
   and not exists(select 1 from public.staff_attendance a where a.employee_id=e.id and a.work_date=d.day::date)
   and not exists(select 1 from public.staff_payrolls p where p.employee_id=e.id and d.day::date between p.period_from and p.period_to)
 order by d.day desc limit 1;
 if v_emp is null then raise exception 'No hay empleado y fecha disponible para test reversible'; end if;

 v_count:=public.admin_staff_save_week(jsonb_build_array(jsonb_build_object(
 'employee_id',v_emp,'day',v_day,'kind','absent','expected_id',null)));
 if v_count<>1 then raise exception 'No se creó la asistencia'; end if;
 select id into v_att from public.staff_attendance where employee_id=v_emp and work_date=v_day;
 if v_att is null then raise exception 'La asistencia no existe'; end if;

 v_failed:=false;
 begin perform public.admin_staff_save_week(jsonb_build_array(jsonb_build_object(
 'employee_id',v_emp,'day',v_day,'kind','present','expected_id',null)));
 exception when others then v_failed:=true; end;
 if not v_failed then raise exception 'No se rechazó un snapshot obsoleto'; end if;

 v_failed:=false;
 begin perform public.admin_staff_save_week(jsonb_build_array(jsonb_build_object(
 'employee_id',v_emp,'day',(now() at time zone 'America/Argentina/Buenos_Aires')::date+1,
 'kind','present','expected_id',null)));
 exception when others then v_failed:=true; end;
 if not v_failed then raise exception 'Se permitió una fecha futura'; end if;

 v_count:=public.admin_staff_approve_week(array[v_att]);
 if v_count<>1 or not exists(select 1 from public.staff_attendance
 where id=v_att and approval_status='approved' and amount_snapshot=0) then
 raise exception 'No se aprobó ausencia con valor cero'; end if;

 v_failed:=false;
 begin perform public.admin_staff_approve_week(array[v_att]);
 exception when others then v_failed:=true; end;
 if not v_failed then raise exception 'Se permitió aprobación duplicada'; end if;

 v_payroll:=public.admin_staff_create_payroll_batch(array[v_emp],v_day,v_day);
 if jsonb_array_length(v_payroll)<>1 then raise exception 'No creó liquidación por lote'; end if;
 if not exists(select 1 from public.staff_payroll_lines where attendance_id=v_att) then
 raise exception 'Liquidación sin snapshot'; end if;

 v_failed:=false;
 begin perform public.admin_staff_save_attendance(v_emp,v_day,'present','tardía',null);
 exception when others then v_failed:=true; end;
 if not v_failed then raise exception 'Permitió alterar una fecha ya liquidada'; end if;

 if has_function_privilege('anon','public.admin_staff_save_week(jsonb)','EXECUTE')
 or has_function_privilege('anon','public.admin_staff_approve_week(uuid[])','EXECUTE')
 or has_function_privilege('anon','public.admin_staff_create_payroll_batch(uuid[],date,date)','EXECUTE') then
 raise exception 'Una RPC de nómina es accesible por anon'; end if;
end $test$;
rollback;

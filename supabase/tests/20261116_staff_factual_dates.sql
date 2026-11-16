-- Ejecutar solo en central-burguer-dev. Todos los ensayos se revierten.
begin;
select set_config('request.jwt.claim.sub',(
 select ur.user_id::text from public.user_roles ur
 join public.roles r on r.id=ur.role_id and r.code='admin' limit 1
),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
 v_employee uuid;
 v_future date := (now() at time zone 'America/Argentina/Buenos_Aires')::date + 1;
 v_attendance uuid;
 v_rejected boolean;
begin
 select id into v_employee from public.staff_employees where active limit 1;
 if v_employee is null then raise exception 'Se requiere un usuario con rol Personal activo en DEV'; end if;

 v_rejected := false;
 begin perform public.admin_staff_save_attendance(v_employee,v_future,'present','prueba');
 exception when others then v_rejected := true; end;
 if not v_rejected then raise exception 'Se permitió registrar asistencia futura'; end if;

 v_rejected := false;
 begin perform public.admin_staff_record_payment(v_employee,null,10,v_future,'advance','prueba',gen_random_uuid());
 exception when others then v_rejected := true; end;
 if not v_rejected then raise exception 'Se permitió registrar pago futuro'; end if;

 v_rejected := false;
 begin perform public.admin_staff_create_payroll(v_employee,v_future,v_future,'prueba');
 exception when others then v_rejected := true; end;
 if not v_rejected then raise exception 'Se permitió liquidar un período futuro'; end if;

 -- Testear aprobación futura con un registro de prueba, sin alterar asistencias existentes.
 insert into public.staff_attendance (employee_id,work_date,attendance_kind,notes)
 values (v_employee,v_future,'present','prueba reversible')
 on conflict (employee_id,work_date) do nothing;
 select id into v_attendance from public.staff_attendance
 where employee_id=v_employee and work_date=v_future;
 v_rejected := false;
 begin perform public.admin_staff_approve_attendance(v_attendance);
 exception when others then v_rejected := true; end;
 if not v_rejected then raise exception 'Se permitió aprobar asistencia futura'; end if;
end $test$;
rollback;

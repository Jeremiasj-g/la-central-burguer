-- Ejecutar solo en una base de desarrollo con al menos una cuenta admin.
-- TODAS las operaciones de prueba quedan anuladas por ROLLBACK.
begin;
select set_config('request.jwt.claim.sub',(
 select ur.user_id::text from public.user_roles ur
 join public.roles r on r.id=ur.role_id and r.code='admin'
 limit 1
),true);
select set_config('request.jwt.claim.role','authenticated',true);
do $smoke$
declare v_employee uuid; v_attendance uuid; v_payroll uuid; v_payment uuid;
 v_advance uuid; v_allocation uuid; v_idempotency uuid:=gen_random_uuid();
 v_amount numeric; v_rejected boolean;
begin
 if not private.is_admin() then raise exception 'Se necesita un administrador de prueba'; end if;
 v_employee:=public.admin_staff_save_employee(null,'Empleado Test Payroll','no persistir',true);
 perform public.admin_staff_add_rate(v_employee,'2026-10-01',100,150,200);
 v_attendance:=public.admin_staff_save_attendance(v_employee,'2026-11-14','present','sábado');
 v_amount:=public.admin_staff_approve_attendance(v_attendance);
 if v_amount<>150 then raise exception 'Tarifa sábado incorrecta'; end if;
 perform public.admin_staff_save_attendance(v_employee,'2026-11-14','present','corregida','motivo prueba');
 if (select count(*) from public.staff_attendance_corrections where attendance_id=v_attendance)<>1
 then raise exception 'Falta auditoría de corrección'; end if;
 perform public.admin_staff_approve_attendance(v_attendance);
 v_attendance:=public.admin_staff_save_attendance(v_employee,'2026-11-15','present','domingo');
 if public.admin_staff_approve_attendance(v_attendance)<>200 then raise exception 'Tarifa domingo incorrecta'; end if;
 v_attendance:=public.admin_staff_save_attendance(v_employee,'2026-11-16','absent','ausencia');
 if public.admin_staff_approve_attendance(v_attendance)<>0 then raise exception 'Ausencia incorrecta'; end if;
 v_payroll:=public.admin_staff_create_payroll(v_employee,'2026-11-14','2026-11-16');
 if (select sum(rate_amount_snapshot) from public.staff_payroll_lines where payroll_id=v_payroll)<>350 then
 raise exception 'Total devengado incorrecto'; end if;
 v_rejected:=false;
 begin perform public.admin_staff_create_payroll(v_employee,'2026-11-15','2026-11-16');
 exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'Se aceptó período solapado'; end if;
 v_payment:=public.admin_staff_record_payment(v_employee,v_payroll,100,'2026-11-16','payroll',null,v_idempotency);
 if public.admin_staff_record_payment(v_employee,v_payroll,100,'2026-11-16','payroll',null,v_idempotency)<>v_payment
 then raise exception 'Idempotencia no respetada'; end if;
 v_rejected:=false;
 begin perform public.admin_staff_record_payment(v_employee,v_payroll,120,'2026-11-16','payroll',null,v_idempotency);
 exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'La misma clave aceptó dos importes'; end if;
 v_advance:=public.admin_staff_record_payment(v_employee,null,50,'2026-11-16','advance',null,gen_random_uuid());
 v_allocation:=public.admin_staff_apply_advance(v_advance,v_payroll,50);
 perform public.admin_staff_reverse_allocation(v_allocation,'motivo prueba');
 perform public.admin_staff_reverse_payment(v_advance,'motivo prueba');
 perform public.admin_staff_reverse_payment(v_payment,'motivo prueba');
end $smoke$;
rollback;

-- Repetir con rol authenticated no administrador.
begin;
select set_config('request.jwt.claim.sub',(
 select u.user_id::text from public.user_roles u
 where not exists (
   select 1 from public.user_roles x join public.roles r on r.id=x.role_id
   where x.user_id=u.user_id and r.code='admin'
 ) limit 1
),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
do $deny$
declare v_denied boolean:=false;
begin
 if (select count(*) from public.staff_employees)<>0 then raise exception 'El no-admin puede leer el personal'; end if;
 begin perform public.admin_staff_dashboard(); exception when others then v_denied:=true; end;
 if not v_denied then raise exception 'El no-admin accede al panel'; end if;
end $deny$;
rollback;

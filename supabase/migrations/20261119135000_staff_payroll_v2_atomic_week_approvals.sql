-- Atomic approval of the selected week's pending attendance rows.
create or replace function public.admin_staff_approve_week(attendance_uuids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_count integer := 0;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if attendance_uuids is null or array_length(attendance_uuids,1) not between 1 and 140
 or array_position(attendance_uuids,null) is not null
 or (select count(distinct x) from unnest(attendance_uuids) x)<>array_length(attendance_uuids,1)
 then raise exception 'Seleccioná asistencias pendientes válidas'; end if;
 for v_id in select unnest(attendance_uuids) order by 1 loop
   if not exists(select 1 from public.staff_attendance where id=v_id and approval_status='pending') then
     raise exception 'La lista incluye una asistencia ya aprobada o inexistente'; end if;
   perform public.admin_staff_approve_attendance(v_id);
   v_count:=v_count+1;
 end loop;
 return v_count;
end $$;
revoke execute on function public.admin_staff_approve_week(uuid[]) from public,anon;
grant execute on function public.admin_staff_approve_week(uuid[]) to authenticated;

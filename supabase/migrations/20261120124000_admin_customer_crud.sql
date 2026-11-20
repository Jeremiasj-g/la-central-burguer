create or replace function public.admin_create_customer(
 new_name text,new_phone text,new_address text
) returns uuid language plpgsql security definer set search_path='' as $$
declare id uuid; digits text:=regexp_replace(coalesce(new_phone,''),'[^0-9]','','g');
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if length(btrim(coalesce(new_name,''))) not between 2 and 120 or
 length(digits)<6 or length(new_phone)>40 or length(coalesce(new_address,''))>240
 then raise exception 'Datos de cliente inválidos'; end if;
 insert into public.customers(full_name,phone,normalized_phone,default_address)
 values(btrim(new_name),btrim(new_phone),digits,nullif(btrim(coalesce(new_address,'')),''))
 returning customers.id into id;
 return id;
end $$;
create or replace function public.admin_delete_customer_without_orders(target_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if exists(select 1 from public.orders where customer_id=target_id) then
  raise exception 'Este cliente tiene pedidos históricos y no puede eliminarse'; end if;
 delete from public.customers where id=target_id;
 if not found then raise exception 'Cliente inexistente'; end if;
end $$;
revoke all on function public.admin_create_customer(text,text,text) from public,anon;
revoke all on function public.admin_delete_customer_without_orders(uuid) from public,anon;
grant execute on function public.admin_create_customer(text,text,text) to authenticated;
grant execute on function public.admin_delete_customer_without_orders(uuid) to authenticated;

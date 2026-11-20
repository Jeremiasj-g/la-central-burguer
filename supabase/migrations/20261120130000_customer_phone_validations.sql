-- Profile and admin contact numbers require a sensible format; blank remains optional.
create or replace function public.save_my_customer_account(
 new_name text,new_phone text,new_address text
) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Debés iniciar sesión'; end if;
 if btrim(coalesce(new_phone,''))<>'' and (
   length(regexp_replace(new_phone,'[^0-9]','','g'))<6 or
   new_phone !~ '^[+()0-9 .-]+$'
 ) then raise exception 'Ingresá un teléfono válido con al menos seis dígitos'; end if;
 if length(btrim(coalesce(new_name,''))) not between 2 and 120 or
 length(coalesce(new_phone,''))>40 or length(coalesce(new_address,''))>240
 then raise exception 'Revisá los datos personales'; end if;
 insert into public.customer_accounts(user_id,full_name,phone,address)
 values(uid,btrim(new_name),btrim(coalesce(new_phone,'')),btrim(coalesce(new_address,'')))
 on conflict (user_id) do update set
 full_name=excluded.full_name,phone=excluded.phone,address=excluded.address,updated_at=now();
end $$;

create or replace function public.admin_update_customer_directory(
 kind text, target_id uuid, new_name text, new_phone text, new_address text
) returns void language plpgsql security definer set search_path='' as $$
declare phone_digits text;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 if btrim(coalesce(new_phone,''))<>'' and (
   length(regexp_replace(new_phone,'[^0-9]','','g'))<6 or
   new_phone !~ '^[+()0-9 .-]+$'
 ) then raise exception 'Ingresá un teléfono válido con al menos seis dígitos'; end if;
 if target_id is null or length(btrim(coalesce(new_name,''))) not between 2 and 120
 or length(coalesce(new_phone,''))>40 or length(coalesce(new_address,''))>240
 then raise exception 'Datos de cliente inválidos'; end if;
 if kind='registered' then
  update public.customer_accounts set full_name=btrim(new_name),
   phone=btrim(coalesce(new_phone,'')),address=btrim(coalesce(new_address,'')),updated_at=now()
   where user_id=target_id;
 elsif kind='commercial' then
  phone_digits:=regexp_replace(coalesce(new_phone,''),'[^0-9]','','g');
  if length(phone_digits)<6 then raise exception 'El teléfono comercial debe tener al menos seis dígitos';end if;
  update public.customers set full_name=btrim(new_name),phone=btrim(new_phone),
   normalized_phone=phone_digits,default_address=nullif(btrim(coalesce(new_address,'')),''),
   updated_at=now() where id=target_id;
 else raise exception 'Tipo de cliente inválido';
 end if;
 if not found then raise exception 'Cliente inexistente'; end if;
end $$;

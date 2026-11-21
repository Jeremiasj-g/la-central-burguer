create or replace function public.my_customer_account()
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.customer_accounts%rowtype; u auth.users%rowtype; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Debés iniciar sesión'; end if;
 select * into u from auth.users where id=uid;
 if not found then raise exception 'Sesión no válida'; end if;
 insert into public.customer_accounts(user_id,full_name)
 values(uid,left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
  nullif(btrim(u.raw_user_meta_data->>'name'),''),''),120))
 on conflict(user_id) do nothing;
 select * into a from public.customer_accounts where user_id=uid;
 return jsonb_build_object('id',uid,'name',a.full_name,'email',u.email,
 'phone',a.phone,'address',a.address);
end $$;
create or replace function public.save_my_customer_account(
 new_name text,new_phone text,new_address text
) returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Debés iniciar sesión'; end if;
 if length(btrim(coalesce(new_name,''))) not between 2 and 120 or
 length(coalesce(new_phone,''))>40 or length(coalesce(new_address,''))>240
 then raise exception 'Revisá los datos personales'; end if;
 insert into public.customer_accounts(user_id,full_name,phone,address)
 values(uid,btrim(new_name),btrim(coalesce(new_phone,'')),btrim(coalesce(new_address,'')))
 on conflict (user_id) do update set
 full_name=excluded.full_name,phone=excluded.phone,address=excluded.address,updated_at=now();
end $$;
revoke all on function public.my_customer_account() from public,anon;
revoke all on function public.save_my_customer_account(text,text,text) from public,anon;
grant execute on function public.my_customer_account() to authenticated;
grant execute on function public.save_my_customer_account(text,text,text) to authenticated;

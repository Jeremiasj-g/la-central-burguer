-- Customer-facing identities are independent from phone-based commercial customers.
-- No historical order is linked automatically from a matching phone/name/email.
create table if not exists public.customer_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '' check (length(full_name)<=120),
 phone text not null default '' check (length(phone)<=40),
 address text not null default '' check (length(address)<=240),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.customer_order_links (
 order_id uuid primary key references public.orders(id) on delete cascade,
 user_id uuid not null references public.customer_accounts(user_id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists idx_customer_order_links_user on public.customer_order_links(user_id,created_at desc);
alter table public.customer_accounts enable row level security;
alter table public.customer_order_links enable row level security;
drop policy if exists customer_account_read on public.customer_accounts;
create policy customer_account_read on public.customer_accounts for select to authenticated
 using (user_id=(select auth.uid()) or (select private.is_admin()));
drop policy if exists customer_account_insert on public.customer_accounts;
create policy customer_account_insert on public.customer_accounts for insert to authenticated
 with check (user_id=(select auth.uid()));
drop policy if exists customer_account_update on public.customer_accounts;
create policy customer_account_update on public.customer_accounts for update to authenticated
 using (user_id=(select auth.uid()) or (select private.is_admin()))
 with check (user_id=(select auth.uid()) or (select private.is_admin()));
drop policy if exists customer_order_owner_read on public.customer_order_links;
create policy customer_order_owner_read on public.customer_order_links for select to authenticated
 using (user_id=(select auth.uid()) or (select private.is_admin()));
-- Linking orders is server-only; no client INSERT/UPDATE/DELETE grants.
revoke all on public.customer_accounts,public.customer_order_links from anon,authenticated;
grant select,insert,update on public.customer_accounts to authenticated;
grant select on public.customer_order_links to authenticated;
create or replace function public.my_customer_orders()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare id uuid := auth.uid();
begin
 if id is null then raise exception 'Iniciá sesión para consultar tus pedidos'; end if;
 return coalesce((
  select jsonb_agg(jsonb_build_object(
   'id',o.id,'code',o.order_code,'createdAt',o.created_at,
   'status',o.status,'total',o.total,'deliveryMethod',o.delivery_method,
   'items',coalesce((select jsonb_agg(jsonb_build_object(
     'name',oi.product_name,'quantity',oi.quantity,'price',oi.unit_price))
       from public.order_items oi where oi.order_id=o.id),'[]'::jsonb))
  order by o.created_at desc)
  from public.customer_order_links link
  join public.orders o on o.id=link.order_id
  where link.user_id=id
 ),'[]'::jsonb);
end $$;
create or replace function public.admin_customer_directory()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
 return jsonb_build_object(
  'registered',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',a.user_id,'name',a.full_name,'email',u.email,
    'phone',a.phone,'address',a.address,'createdAt',a.created_at,
    'orders',(select count(*) from public.customer_order_links l where l.user_id=a.user_id))
   order by a.created_at desc)
   from public.customer_accounts a join auth.users u on u.id=a.user_id
  ),'[]'::jsonb),
  'commercial',coalesce((
   select jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.full_name,'email',c.email,'phone',c.phone,
    'address',c.default_address,'createdAt',c.created_at,
    'orders',c.order_count)
   order by c.created_at desc)
   from public.customers c
  ),'[]'::jsonb)
 );
end $$;
create or replace function public.admin_update_customer_directory(
 kind text, target_id uuid, new_name text, new_phone text, new_address text
) returns void language plpgsql security definer set search_path='' as $$
declare phone_digits text;
begin
 if not private.is_admin() then raise exception 'No autorizado'; end if;
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
revoke all on function public.my_customer_orders() from public,anon;
revoke all on function public.admin_customer_directory() from public,anon;
revoke all on function public.admin_update_customer_directory(text,uuid,text,text,text) from public,anon;
grant execute on function public.my_customer_orders() to authenticated;
grant execute on function public.admin_customer_directory() to authenticated;
grant execute on function public.admin_update_customer_directory(text,uuid,text,text,text) to authenticated;

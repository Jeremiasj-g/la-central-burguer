alter table public.profiles
  add column if not exists phone text,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint roles_code_format check (code ~ '^[a-z][a-z0-9_.-]{1,49}$')
);
create unique index roles_code_uidx on public.roles(lower(code));
create unique index roles_name_uidx on public.roles(lower(name));
create index roles_active_idx on public.roles(active, name);
create index roles_created_by_idx on public.roles(created_by);
create trigger roles_set_updated_at before update on public.roles
for each row execute function public.set_updated_at();

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module text not null,
  description text,
  is_system boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint permissions_code_format check (code ~ '^[a-z][a-z0-9_.-]{2,79}$')
);
create unique index permissions_code_uidx on public.permissions(lower(code));
create index permissions_module_idx on public.permissions(module, name);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_id)
);
create index role_permissions_permission_idx on public.role_permissions(permission_id, role_id);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles(role_id, user_id);
create index user_roles_assigned_by_idx on public.user_roles(assigned_by);

insert into public.roles(code, name, description, is_system, active)
values
  ('admin', 'Administrador', 'Acceso total al panel administrativo y a la gestión de seguridad.', true, true),
  ('staff', 'Personal', 'Rol base para futuros usuarios internos sin privilegios administrativos.', true, true),
  ('delivery', 'Delivery', 'Acceso al panel operativo de reparto y únicamente a sus entregas.', true, true);

insert into public.permissions(code, name, module, description, is_system, active)
values
  ('admin.access', 'Acceder al panel administrativo', 'Administración', 'Permite ingresar al panel administrativo.', true, true),
  ('users.manage', 'Gestionar usuarios', 'Seguridad', 'Alta, edición, activación, archivo y credenciales de usuarios.', true, true),
  ('roles.manage', 'Gestionar roles', 'Seguridad', 'Crear, editar y administrar roles y sus permisos.', true, true),
  ('delivery.manage', 'Gestionar delivery', 'Delivery', 'Administrar repartidores, asignaciones y liquidaciones.', true, true),
  ('delivery.operate', 'Operar como repartidor', 'Delivery', 'Acceder al panel propio de entregas asignadas.', true, true),
  ('orders.manage', 'Gestionar pedidos', 'Pedidos', 'Administrar pedidos y sus estados.', true, true),
  ('catalog.manage', 'Gestionar catálogo', 'Catálogo', 'Administrar productos, categorías, ingredientes y recetas.', true, true),
  ('reports.view', 'Ver reportes', 'Reportes', 'Consultar reportes y métricas administrativas.', true, true),
  ('settings.manage', 'Gestionar configuración', 'Configuración', 'Modificar la configuración general del negocio.', true, true);

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'admin';
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.code = 'delivery.operate' where r.code = 'delivery';

insert into public.user_roles(user_id, role_id, assigned_by)
select p.id, r.id, p.id
from public.profiles p
join public.roles r on r.code = p.role::text;

update public.profiles p
set phone = d.phone
from public.delivery_drivers d
where d.profile_id = p.id and p.phone is null and d.phone is not null;

create or replace function private.has_role(role_code text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and lower(r.code) = lower(role_code)
      and r.active = true
      and p.active = true
      and p.archived_at is null
  );
$$;
revoke all on function private.has_role(text) from public;
grant execute on function private.has_role(text) to authenticated;

create or replace function private.has_permission(permission_code text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions pe on pe.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and lower(pe.code) = lower(permission_code)
      and r.active = true
      and pe.active = true
      and pr.active = true
      and pr.archived_at is null
  );
$$;
revoke all on function private.has_permission(text) from public;
grant execute on function private.has_permission(text) to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select private.has_role('admin');
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create or replace function private.current_delivery_driver_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select d.profile_id
  from public.delivery_drivers d
  join public.profiles p on p.id = d.profile_id
  where d.profile_id = auth.uid()
    and d.active = true
    and p.active = true
    and p.archived_at is null
    and private.has_role('delivery')
  limit 1;
$$;
revoke all on function private.current_delivery_driver_id() from public;
grant execute on function private.current_delivery_driver_id() to authenticated;

create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.get_current_access_context()
returns jsonb language plpgsql stable security definer set search_path = public, private, auth as $$
declare uid uuid := auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'No autenticado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'userId', p.id,
    'fullName', p.full_name,
    'phone', p.phone,
    'active', p.active and p.archived_at is null,
    'email', u.email,
    'roles', coalesce((select jsonb_agg(r.code order by r.code) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.id and r.active = true), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(distinct pe.code order by pe.code) from public.user_roles ur join public.roles r on r.id = ur.role_id and r.active = true join public.role_permissions rp on rp.role_id = r.id join public.permissions pe on pe.id = rp.permission_id and pe.active = true where ur.user_id = p.id), '[]'::jsonb)
  ) into result
  from public.profiles p join auth.users u on u.id = p.id where p.id = uid;
  return result;
end;
$$;
revoke all on function public.get_current_access_context() from public, anon;
grant execute on function public.get_current_access_context() to authenticated;

create or replace function public.get_access_management_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public, private, auth as $$
declare result jsonb;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'fullName', p.full_name, 'email', u.email, 'phone', p.phone, 'notes', p.notes,
        'active', p.active and p.archived_at is null, 'archivedAt', p.archived_at,
        'createdAt', u.created_at, 'lastSignInAt', u.last_sign_in_at,
        'roles', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'code', r.code, 'name', r.name) order by r.name) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.id), '[]'::jsonb),
        'delivery', case when d.profile_id is null then null else jsonb_build_object('vehicleType', d.vehicle_type, 'active', d.active, 'commissionPercent', dr.commission_percent) end
      ) order by p.full_name, u.email)
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.delivery_drivers d on d.profile_id = p.id
      left join lateral (select commission_percent from public.delivery_driver_rates rr where rr.driver_id = p.id and rr.valid_to is null order by rr.valid_from desc limit 1) dr on true
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'code', r.code, 'name', r.name, 'description', r.description, 'isSystem', r.is_system,
        'active', r.active, 'usersCount', (select count(*) from public.user_roles ur where ur.role_id = r.id),
        'permissionCodes', coalesce((select jsonb_agg(pe.code order by pe.module, pe.name) from public.role_permissions rp join public.permissions pe on pe.id = rp.permission_id where rp.role_id = r.id), '[]'::jsonb)
      ) order by r.is_system desc, r.name) from public.roles r
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', pe.id, 'code', pe.code, 'name', pe.name, 'module', pe.module, 'description', pe.description, 'active', pe.active) order by pe.module, pe.name)
      from public.permissions pe where pe.active = true
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_access_management_dashboard() from public, anon;
grant execute on function public.get_access_management_dashboard() to authenticated;

create or replace function public.admin_create_role(role_code text, role_name text, role_description text default null, permission_codes text[] default array[]::text[])
returns uuid language plpgsql security definer set search_path = public, private as $$
declare actor uuid := auth.uid(); new_role_id uuid; normalized_code text := lower(btrim(role_code)); normalized_name text := btrim(role_name); requested_count integer; found_count integer;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if normalized_code !~ '^[a-z][a-z0-9_.-]{1,49}$' then raise exception 'Código de rol inválido.' using errcode = '22023'; end if;
  if length(normalized_name) < 2 then raise exception 'El nombre del rol es obligatorio.' using errcode = '22023'; end if;
  select count(distinct lower(value)) into requested_count from unnest(coalesce(permission_codes, array[]::text[])) as value;
  select count(*) into found_count from public.permissions pe where pe.active = true and lower(pe.code) in (select lower(value) from unnest(coalesce(permission_codes, array[]::text[])) as value);
  if requested_count <> found_count then raise exception 'Uno o más permisos no existen o están inactivos.' using errcode = '22023'; end if;
  insert into public.roles(code, name, description, is_system, active, created_by)
  values (normalized_code, normalized_name, nullif(btrim(role_description), ''), false, true, actor)
  returning id into new_role_id;
  insert into public.role_permissions(role_id, permission_id)
  select new_role_id, pe.id from public.permissions pe where lower(pe.code) in (select lower(value) from unnest(coalesce(permission_codes, array[]::text[])) as value)
  on conflict do nothing;
  return new_role_id;
end;
$$;
revoke all on function public.admin_create_role(text, text, text, text[]) from public, anon;
grant execute on function public.admin_create_role(text, text, text, text[]) to authenticated;

create or replace function public.admin_update_role(role_uuid uuid, role_code text, role_name text, role_description text, role_active boolean, permission_codes text[] default array[]::text[])
returns void language plpgsql security definer set search_path = public, private as $$
declare target_role public.roles%rowtype; normalized_code text := lower(btrim(role_code)); normalized_name text := btrim(role_name); requested_count integer; found_count integer;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into target_role from public.roles where id = role_uuid for update;
  if not found then raise exception 'Rol no encontrado.' using errcode = 'P0001'; end if;
  if normalized_code !~ '^[a-z][a-z0-9_.-]{1,49}$' then raise exception 'Código de rol inválido.' using errcode = '22023'; end if;
  if length(normalized_name) < 2 then raise exception 'El nombre del rol es obligatorio.' using errcode = '22023'; end if;
  if target_role.is_system and normalized_code <> target_role.code then raise exception 'El código de un rol del sistema no puede modificarse.' using errcode = '22023'; end if;
  if target_role.is_system and role_active = false then raise exception 'Los roles del sistema no pueden desactivarse.' using errcode = '22023'; end if;
  select count(distinct lower(value)) into requested_count from unnest(coalesce(permission_codes, array[]::text[])) as value;
  select count(*) into found_count from public.permissions pe where pe.active = true and lower(pe.code) in (select lower(value) from unnest(coalesce(permission_codes, array[]::text[])) as value);
  if requested_count <> found_count then raise exception 'Uno o más permisos no existen o están inactivos.' using errcode = '22023'; end if;
  update public.roles set code = normalized_code, name = normalized_name, description = nullif(btrim(role_description), ''), active = role_active where id = role_uuid;
  delete from public.role_permissions where role_id = role_uuid;
  insert into public.role_permissions(role_id, permission_id)
  select role_uuid, pe.id from public.permissions pe where lower(pe.code) in (select lower(value) from unnest(coalesce(permission_codes, array[]::text[])) as value)
  on conflict do nothing;
end;
$$;
revoke all on function public.admin_update_role(uuid, text, text, text, boolean, text[]) from public, anon;
grant execute on function public.admin_update_role(uuid, text, text, text, boolean, text[]) to authenticated;

create or replace function public.admin_delete_role(role_uuid uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare target_role public.roles%rowtype;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into target_role from public.roles where id = role_uuid for update;
  if not found then raise exception 'Rol no encontrado.' using errcode = 'P0001'; end if;
  if target_role.is_system then raise exception 'Los roles del sistema no pueden eliminarse.' using errcode = '22023'; end if;
  if exists (select 1 from public.user_roles where role_id = role_uuid) then raise exception 'No se puede eliminar un rol asignado a usuarios.' using errcode = '23503'; end if;
  delete from public.roles where id = role_uuid;
end;
$$;
revoke all on function public.admin_delete_role(uuid) from public, anon;
grant execute on function public.admin_delete_role(uuid) to authenticated;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
revoke all on public.roles, public.permissions, public.role_permissions, public.user_roles from anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions, public.user_roles to authenticated;
create policy roles_admin_select on public.roles for select to authenticated using ((select private.is_admin()));
create policy permissions_admin_select on public.permissions for select to authenticated using ((select private.is_admin()));
create policy role_permissions_admin_select on public.role_permissions for select to authenticated using ((select private.is_admin()));
create policy user_roles_admin_or_self_select on public.user_roles for select to authenticated using ((select private.is_admin()) or user_id = (select auth.uid()));

create or replace function public.admin_set_delivery_driver_rate(target_driver_id uuid, new_percent numeric)
returns void language plpgsql security definer set search_path = public, private as $$
declare actor uuid := auth.uid(); stamp timestamptz := timezone('utc', now());
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if new_percent is null or new_percent < 0 or new_percent > 100 then raise exception 'El porcentaje de comisión debe estar entre 0 y 100.' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.delivery_drivers d
    join public.user_roles ur on ur.user_id = d.profile_id
    join public.roles r on r.id = ur.role_id and r.code = 'delivery' and r.active = true
    where d.profile_id = target_driver_id
  ) then raise exception 'Repartidor no encontrado.' using errcode = 'P0001'; end if;
  update public.delivery_driver_rates set valid_to = stamp where driver_id = target_driver_id and valid_to is null;
  insert into public.delivery_driver_rates(driver_id, commission_percent, valid_from, created_by)
  values (target_driver_id, round(new_percent::numeric, 2), stamp, actor);
end;
$$;

create or replace function public.admin_assign_delivery(order_uuid uuid, driver_uuid uuid, note text default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  actor uuid := auth.uid();
  target_order public.orders%rowtype;
  selected_rate public.delivery_driver_rates%rowtype;
  current_assignment_id uuid;
  current_driver_id uuid;
  new_assignment_id uuid;
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  select * into target_order from public.orders where id = order_uuid for update;
  if not found then raise exception 'Pedido no encontrado.' using errcode = 'P0001'; end if;
  if target_order.delivery_method <> 'delivery' then raise exception 'El pedido no es delivery.' using errcode = '22023'; end if;
  if target_order.status in ('cancelado', 'entregado') then raise exception 'El pedido ya no admite asignación.' using errcode = '22023'; end if;

  if not exists (
    select 1
    from public.delivery_drivers d
    join public.profiles p on p.id = d.profile_id
    join public.user_roles ur on ur.user_id = d.profile_id
    join public.roles r on r.id = ur.role_id and r.code = 'delivery' and r.active = true
    where d.profile_id = driver_uuid and d.active = true and p.active = true and p.archived_at is null
  ) then raise exception 'El repartidor no está disponible.' using errcode = 'P0001'; end if;

  select * into selected_rate
  from public.delivery_driver_rates
  where driver_id = driver_uuid and valid_from <= timezone('utc', now()) and (valid_to is null or valid_to > timezone('utc', now()))
  order by valid_from desc limit 1;
  if selected_rate.id is null then raise exception 'El repartidor no tiene una comisión vigente.' using errcode = 'P0001'; end if;

  select da.id, r.driver_id into current_assignment_id, current_driver_id
  from public.delivery_assignments da
  join public.delivery_driver_rates r on r.id = da.rate_id
  where da.order_id = order_uuid and da.status <> 'cancelled'
  order by da.assigned_at desc limit 1 for update of da;

  if current_assignment_id is not null and current_driver_id = driver_uuid then return current_assignment_id; end if;
  if current_assignment_id is not null then
    update public.delivery_assignments
    set status = 'cancelled', cancelled_at = timezone('utc', now()), cancellation_reason = coalesce(nullif(btrim(note), ''), 'Reasignación administrativa')
    where id = current_assignment_id;
    insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
    values (current_assignment_id, 'cancelled', actor, coalesce(nullif(btrim(note), ''), 'Reasignación administrativa'));
  end if;

  insert into public.delivery_assignments(order_id, rate_id, status, assigned_by)
  values (order_uuid, selected_rate.id, 'assigned', actor)
  returning id into new_assignment_id;
  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (new_assignment_id, 'assigned', actor, nullif(btrim(note), ''));
  return new_assignment_id;
end;
$$;

alter table public.delivery_drivers drop column if exists phone;
alter table public.profiles drop column role;
drop type if exists public.app_role;

alter table public.delivery_assignments
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.delivery_assignments
  drop constraint if exists delivery_assignments_rejection_details_check;

alter table public.delivery_assignments
  add constraint delivery_assignments_rejection_details_check
  check (
    status <> 'rejected_by_customer'
    or (rejected_at is not null and nullif(btrim(rejection_reason), '') is not null)
  );

drop index if exists public.delivery_assignments_one_live_per_order_uidx;
create unique index delivery_assignments_one_live_per_order_uidx
  on public.delivery_assignments(order_id)
  where status not in ('cancelled', 'rejected_by_customer');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_assignments'
  ) then
    alter publication supabase_realtime add table public.delivery_assignments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'delivery_assignment_compensation'
  ) then
    alter publication supabase_realtime add table public.delivery_assignment_compensation;
  end if;
end $$;

create or replace function public.driver_reject_delivery(assignment_uuid uuid, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  driver uuid := private.current_delivery_driver_id();
  current_assignment public.delivery_assignments%rowtype;
  normalized_reason text := coalesce(nullif(btrim(reason), ''), 'Cliente rechazó el pedido');
  stamp timestamptz := timezone('utc', now());
begin
  if driver is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select da.* into current_assignment
  from public.delivery_assignments da
  join public.delivery_driver_rates r on r.id = da.rate_id
  where da.id = assignment_uuid and r.driver_id = driver
  for update of da;

  if not found then
    raise exception 'Asignación no encontrada.' using errcode = 'P0001';
  end if;

  if current_assignment.status not in ('assigned', 'accepted', 'picked_up', 'in_transit') then
    raise exception 'La entrega ya está cerrada y no puede rechazarse.' using errcode = '22023';
  end if;

  update public.delivery_assignments
  set status = 'rejected_by_customer',
      rejected_at = stamp,
      rejection_reason = normalized_reason
  where id = assignment_uuid;

  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (assignment_uuid, 'rejected_by_customer', driver, normalized_reason);

  update public.orders
  set status = 'cancelado'
  where id = current_assignment.order_id
    and status not in ('cancelado', 'entregado');

  return jsonb_build_object(
    'assignmentId', assignment_uuid,
    'status', 'rejected_by_customer',
    'reason', normalized_reason,
    'updatedAt', stamp
  );
end;
$$;

revoke all on function public.driver_reject_delivery(uuid, text) from public, anon;
grant execute on function public.driver_reject_delivery(uuid, text) to authenticated;

create or replace function public.admin_cancel_delivery_assignment(assignment_uuid uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  current_status public.delivery_assignment_status;
begin
  if not private.is_admin() then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  select status into current_status
  from public.delivery_assignments
  where id = assignment_uuid
  for update;

  if not found then
    raise exception 'Asignación no encontrada.' using errcode = 'P0001';
  end if;

  if current_status in ('delivered', 'cancelled', 'rejected_by_customer') then
    raise exception 'La asignación ya está cerrada.' using errcode = '22023';
  end if;

  update public.delivery_assignments
  set status = 'cancelled',
      cancelled_at = timezone('utc', now()),
      cancellation_reason = coalesce(nullif(btrim(reason), ''), 'Cancelación administrativa')
  where id = assignment_uuid;

  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (assignment_uuid, 'cancelled', actor, coalesce(nullif(btrim(reason), ''), 'Cancelación administrativa'));
end;
$$;

create or replace function public.admin_assign_delivery(
  order_uuid uuid,
  driver_uuid uuid,
  note text,
  commission_percent_override numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  target_order public.orders%rowtype;
  selected_rate public.delivery_driver_rates%rowtype;
  current_assignment_id uuid;
  current_driver_id uuid;
  current_status public.delivery_assignment_status;
  new_assignment_id uuid;
  normalized_override numeric(5,2);
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if commission_percent_override is not null and (commission_percent_override < 0 or commission_percent_override > 100) then
    raise exception 'La comisión debe estar entre 0 y 100.' using errcode = '22023';
  end if;
  normalized_override := case when commission_percent_override is null then null else round(commission_percent_override::numeric, 2) end;

  select * into target_order from public.orders where id = order_uuid for update;
  if not found then raise exception 'Pedido no encontrado.' using errcode = 'P0001'; end if;
  if target_order.delivery_method <> 'delivery' then raise exception 'El pedido no es delivery.' using errcode = '22023'; end if;
  if target_order.status in ('cancelado', 'entregado') then raise exception 'El pedido ya no admite asignación.' using errcode = '22023'; end if;

  if not exists (
    select 1
    from public.delivery_drivers d
    join public.profiles p on p.id = d.profile_id
    join public.user_roles ur on ur.user_id = d.profile_id
    join public.roles ro on ro.id = ur.role_id and ro.code = 'delivery' and ro.active = true
    where d.profile_id = driver_uuid and d.active = true and p.active = true and p.archived_at is null
  ) then raise exception 'El repartidor no está disponible.' using errcode = 'P0001'; end if;

  select * into selected_rate
  from public.delivery_driver_rates
  where driver_id = driver_uuid
    and valid_from <= timezone('utc', now())
    and (valid_to is null or valid_to > timezone('utc', now()))
  order by valid_from desc limit 1;
  if selected_rate.id is null then raise exception 'El repartidor no tiene una comisión vigente.' using errcode = 'P0001'; end if;

  select da.id, r.driver_id, da.status
  into current_assignment_id, current_driver_id, current_status
  from public.delivery_assignments da
  join public.delivery_driver_rates r on r.id = da.rate_id
  where da.order_id = order_uuid
    and da.status not in ('cancelled', 'rejected_by_customer')
  order by da.assigned_at desc limit 1 for update of da;

  if current_assignment_id is not null and current_driver_id = driver_uuid then
    if current_status not in ('assigned', 'accepted') then
      if normalized_override is distinct from (
        select dac.commission_percent_override
        from public.delivery_assignment_compensation dac
        where dac.assignment_id = current_assignment_id
      ) then
        raise exception 'La comisión no puede modificarse una vez retirado el pedido.' using errcode = '22023';
      end if;
      return current_assignment_id;
    end if;

    update public.delivery_assignment_compensation
    set commission_percent_override = normalized_override
    where assignment_id = current_assignment_id;

    insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
    values (current_assignment_id, current_status, actor, coalesce(nullif(btrim(note), ''), 'Comisión actualizada por administración'));
    return current_assignment_id;
  end if;

  if current_assignment_id is not null then
    update public.delivery_assignments
    set status = 'cancelled',
        cancelled_at = timezone('utc', now()),
        cancellation_reason = coalesce(nullif(btrim(note), ''), 'Reasignación administrativa')
    where id = current_assignment_id;

    insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
    values (current_assignment_id, 'cancelled', actor, coalesce(nullif(btrim(note), ''), 'Reasignación administrativa'));
  end if;

  insert into public.delivery_assignments(order_id, rate_id, status, assigned_by)
  values (order_uuid, selected_rate.id, 'assigned', actor)
  returning id into new_assignment_id;

  insert into public.delivery_assignment_compensation(assignment_id, delivery_fee_snapshot, commission_percent_override)
  values (new_assignment_id, target_order.delivery_cost, normalized_override);

  insert into public.delivery_assignment_events(assignment_id, status, actor_id, note)
  values (new_assignment_id, 'assigned', actor, nullif(btrim(note), ''));

  return new_assignment_id;
end;
$$;

revoke all on function public.admin_assign_delivery(uuid, uuid, text, numeric) from public, anon;
grant execute on function public.admin_assign_delivery(uuid, uuid, text, numeric) to authenticated;

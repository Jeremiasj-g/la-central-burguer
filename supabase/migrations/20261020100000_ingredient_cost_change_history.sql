-- Historial administrativo de costos por ingrediente.
-- No actualiza products.current_price ni modifica asociaciones de recetas.
create table if not exists public.ingredient_cost_history (
  id bigint generated always as identity primary key,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  ingredient_name text not null,
  supplier text null,
  previous_unit_cost numeric(12,2) null,
  new_unit_cost numeric(12,2) not null check (new_unit_cost >= 0),
  previous_unit public.ingredient_unit null,
  unit public.ingredient_unit not null,
  change_type text not null check (change_type in ('baseline','initial','updated')),
  changed_by uuid null,
  recorded_at timestamptz not null default now()
);

create index if not exists ingredient_cost_history_by_ingredient
  on public.ingredient_cost_history (ingredient_id, recorded_at desc, id desc);

alter table public.ingredient_cost_history enable row level security;
revoke all on table public.ingredient_cost_history from anon, authenticated;
grant select on table public.ingredient_cost_history to authenticated;

drop policy if exists ingredient_cost_history_admin_read on public.ingredient_cost_history;
create policy ingredient_cost_history_admin_read
  on public.ingredient_cost_history
  for select to authenticated
  using ((select private.is_admin()));

create or replace function private.track_ingredient_unit_cost()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.unit_cost > 0 then
      insert into public.ingredient_cost_history (
        ingredient_id, ingredient_name, supplier,
        previous_unit_cost, new_unit_cost, previous_unit, unit,
        change_type, changed_by
      ) values (
        new.id, new.name, new.supplier,
        null, new.unit_cost, null, new.unit,
        'initial', auth.uid()
      );
    end if;
  elsif old.unit_cost is distinct from new.unit_cost
        or old.unit is distinct from new.unit then
    insert into public.ingredient_cost_history (
      ingredient_id, ingredient_name, supplier,
      previous_unit_cost, new_unit_cost, previous_unit, unit,
      change_type, changed_by
    ) values (
      new.id, new.name, new.supplier,
      old.unit_cost, new.unit_cost, old.unit, new.unit,
      case when old.unit_cost = 0 and new.unit_cost > 0 then 'initial' else 'updated' end,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_track_ingredient_unit_cost on public.ingredients;
create trigger trg_track_ingredient_unit_cost
after insert or update of unit_cost, unit
on public.ingredients
for each row execute function private.track_ingredient_unit_cost();

-- Capturamos una sola vez el costo vigente en el momento de activar el historial.
-- No se le asigna retrospectivamente una fecha ficticia de factura o compra.
insert into public.ingredient_cost_history (
  ingredient_id, ingredient_name, supplier,
  previous_unit_cost, new_unit_cost, previous_unit, unit, change_type, changed_by
)
select i.id, i.name, i.supplier, null, i.unit_cost, null, i.unit, 'baseline', null
from public.ingredients i
where i.unit_cost > 0
  and not exists (
    select 1 from public.ingredient_cost_history h where h.ingredient_id = i.id
  );

comment on table public.ingredient_cost_history is
'Histórico administrativo de costos, no compras verificadas. No modifica products.current_price.';

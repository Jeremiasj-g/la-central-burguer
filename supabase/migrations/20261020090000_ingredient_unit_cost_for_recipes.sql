-- Costo base utilizado únicamente para el análisis administrativo de recetas.
-- La ampliación no altera los precios actuales ni las asociaciones de productos.
alter table public.ingredients
  add column if not exists unit_cost numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='ingredients_unit_cost_nonnegative'
      and conrelid='public.ingredients'::regclass
  ) then
    alter table public.ingredients
      add constraint ingredients_unit_cost_nonnegative check (unit_cost >= 0);
  end if;
end $$;

comment on column public.ingredients.unit_cost is
  'Costo base del ingrediente por unidad para estimar la rentabilidad administrativa. No actualiza products.current_price.';

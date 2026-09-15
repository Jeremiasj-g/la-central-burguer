begin;

alter table public.ingredients
  add column if not exists unit_cost numeric(12,2) not null default 0
  check (unit_cost >= 0);

comment on column public.ingredients.unit_cost is
  'Costo actual del ingrediente expresado por la unidad base definida en ingredients.unit.';

commit;

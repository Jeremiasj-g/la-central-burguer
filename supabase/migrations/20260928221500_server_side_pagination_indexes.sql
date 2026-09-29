create index if not exists delivery_assignments_assigned_at_idx
  on public.delivery_assignments (assigned_at desc, id desc);

create index if not exists orders_source_created_at_idx
  on public.orders (source, created_at desc, id desc);

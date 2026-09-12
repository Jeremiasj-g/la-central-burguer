create index if not exists delivery_assignment_events_actor_idx on public.delivery_assignment_events(actor_id);
create index if not exists delivery_assignments_assigned_by_idx on public.delivery_assignments(assigned_by);
create index if not exists delivery_driver_rates_created_by_idx on public.delivery_driver_rates(created_by);
create index if not exists delivery_settlements_created_by_idx on public.delivery_settlements(created_by);
create index if not exists delivery_settlements_paid_by_idx on public.delivery_settlements(paid_by);

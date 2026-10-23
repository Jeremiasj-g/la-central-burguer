alter table public.business_config add column if not exists daily_hours jsonb not null default '{}'::jsonb;
alter table public.business_config add constraint business_daily_hours_object check (jsonb_typeof(daily_hours)='object');

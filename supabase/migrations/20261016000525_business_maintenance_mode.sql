-- Modo mantenimiento persistente: el administrador puede pausar los pedidos.
-- RLS business_config_admin_update restringe cambios a administradores.
alter table public.business_config add column if not exists maintenance_mode boolean not null default false;

-- Los RPC de pedidos verifican esta función, incluso para sesiones antiguas.
create or replace function public.is_business_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  config public.business_config%rowtype;
  local_time time;
begin
  select * into config from public.business_config where id = 1;
  if not found or config.maintenance_mode then
    return false;
  end if;
  if not config.auto_schedule_enabled then
    return config.is_open;
  end if;
  local_time := (now() at time zone config.timezone)::time;
  if config.auto_open_time = config.auto_close_time then
    return true;
  elsif config.auto_open_time < config.auto_close_time then
    return local_time >= config.auto_open_time and local_time < config.auto_close_time;
  else
    return local_time >= config.auto_open_time or local_time < config.auto_close_time;
  end if;
end;
$$;

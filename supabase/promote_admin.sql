-- 1) Creá primero el usuario desde Supabase Dashboard > Authentication > Users.
-- 2) Este proyecto está preparado para promover a gusdmeza@gmail.com. Ejecutá el SQL una sola vez.
update public.profiles p
set role = 'admin', active = true, updated_at = timezone('utc', now())
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('gusdmeza@gmail.com');

select u.email, p.full_name, p.role, p.active
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('gusdmeza@gmail.com');

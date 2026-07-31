-- Agrega logo editable al negocio y un bucket público controlado por administradores.
-- Ejecutar una sola vez en Supabase SQL Editor si ya se aplicó la migración inicial.
begin;

alter table public.business_config
  add column if not exists logo_url text not null default '',
  add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_assets_public_read on storage.objects;
drop policy if exists business_assets_admin_insert on storage.objects;
drop policy if exists business_assets_admin_update on storage.objects;
drop policy if exists business_assets_admin_delete on storage.objects;

create policy business_assets_public_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'business-assets');

create policy business_assets_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'business-assets' and (select private.is_admin()));

create policy business_assets_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'business-assets' and (select private.is_admin()))
with check (bucket_id = 'business-assets' and (select private.is_admin()));

create policy business_assets_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'business-assets' and (select private.is_admin()));

commit;

-- Verificación opcional:
-- select id, business_name, logo_url, logo_path from public.business_config where id = 1;
-- select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'business-assets';

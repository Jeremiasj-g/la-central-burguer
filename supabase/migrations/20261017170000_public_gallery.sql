-- Galería opcional de la portada. Aplicada también al proyecto Supabase de producción.
create table if not exists public.gallery_settings (id smallint primary key default 1 check (id=1), enabled boolean not null default false, updated_at timestamptz not null default now());
insert into public.gallery_settings(id,enabled) values(1,false) on conflict(id) do nothing;
create table if not exists public.gallery_images(
 id uuid primary key default gen_random_uuid(), image_url text not null, image_path text not null unique,
 alt_text text not null default '', display_order integer not null default 0 check(display_order>=0),
 created_at timestamptz not null default now(),
 constraint gallery_images_alt_length check(length(alt_text)<=160),
 constraint gallery_images_path_prefix check(image_path like 'gallery/%')
);
create index if not exists gallery_images_order_idx on public.gallery_images(display_order,created_at,id);
alter table public.gallery_settings enable row level security;
alter table public.gallery_images enable row level security;
grant select on public.gallery_settings to anon,authenticated;
grant update on public.gallery_settings to authenticated;
grant select on public.gallery_images to anon,authenticated;
grant insert,update,delete on public.gallery_images to authenticated;
create policy gallery_settings_public_read on public.gallery_settings for select to anon,authenticated using(true);
create policy gallery_settings_admin_update on public.gallery_settings for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy gallery_images_public_read on public.gallery_images for select to anon using(exists(select 1 from public.gallery_settings where id=1 and enabled=true));
create policy gallery_images_authenticated_read on public.gallery_images for select to authenticated using((select private.is_admin()) or exists(select 1 from public.gallery_settings where id=1 and enabled=true));
create policy gallery_images_admin_insert on public.gallery_images for insert to authenticated with check((select private.is_admin()));
create policy gallery_images_admin_update on public.gallery_images for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy gallery_images_admin_delete on public.gallery_images for delete to authenticated using((select private.is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gallery-images','gallery-images',true,4194304,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy gallery_storage_public_read on storage.objects for select to anon,authenticated using(bucket_id='gallery-images');
create policy gallery_storage_admin_insert on storage.objects for insert to authenticated with check(bucket_id='gallery-images' and (select private.is_admin()));
create policy gallery_storage_admin_update on storage.objects for update to authenticated using(bucket_id='gallery-images' and (select private.is_admin())) with check(bucket_id='gallery-images' and (select private.is_admin()));
create policy gallery_storage_admin_delete on storage.objects for delete to authenticated using(bucket_id='gallery-images' and (select private.is_admin()));
do $$ declare tbl text; begin
 foreach tbl in array array['gallery_settings','gallery_images'] loop
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
 execute format('alter publication supabase_realtime add table public.%I',tbl);
 end if;
 end loop;
end $$;

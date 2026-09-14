create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when coalesce(new.raw_user_meta_data ->> 'onboarding_required', 'false') = 'true' then false else true end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

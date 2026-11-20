-- One-time proof that the browser has just completed a guest order.
-- Claims are NOT tied to phone/email; cannot be enumerated by public clients.
create table public.customer_order_claims (
 order_id uuid primary key references public.orders(id) on delete cascade,
 token_hash text not null unique check (length(token_hash)=64),
 expires_at timestamptz not null,
 claimed_at timestamptz
);
alter table public.customer_order_claims enable row level security;
revoke all on public.customer_order_claims from anon,authenticated;
create or replace function public.claim_my_customer_order(claim_token text)
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); claimed uuid;
begin
 if uid is null then raise exception 'Iniciá sesión'; end if;
 if claim_token is null or length(claim_token) not between 32 and 128
 then raise exception 'Código de vinculación inválido'; end if;
 select order_id into claimed from public.customer_order_claims
  where token_hash=encode(sha256(convert_to(claim_token,'UTF8')),'hex')
   and claimed_at is null and expires_at>now()
  for update;
 if claimed is null then return false; end if;
 insert into public.customer_accounts(user_id) values(uid) on conflict do nothing;
 insert into public.customer_order_links(order_id,user_id) values(claimed,uid)
   on conflict(order_id) do nothing;
 update public.customer_order_claims set claimed_at=now() where order_id=claimed;
 return true;
end $$;
revoke all on function public.claim_my_customer_order(text) from public,anon;
grant execute on function public.claim_my_customer_order(text) to authenticated;

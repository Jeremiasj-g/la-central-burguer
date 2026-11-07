-- Collections report is based on confirmed movements only, not customer preferences.
-- Historic orders lacking recorded movements are deliberately excluded.
create or replace function public.admin_payment_collections_summary(
  from_ts timestamptz default null,
  to_ts timestamptz default null
) returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare result jsonb;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'No tenés permisos para consultar cobros.' using errcode='42501';
  end if;
  if from_ts is not null and to_ts is not null and to_ts <= from_ts then
    raise exception 'El rango de cobros es inválido.' using errcode='22023';
  end if;
  select jsonb_build_object(
    'cash',coalesce(sum(case when method='efectivo' then case when kind='payment' then amount else -amount end else 0 end),0),
    'transfer',coalesce(sum(case when method='transferencia' then case when kind='payment' then amount else -amount end else 0 end),0),
    'total',coalesce(sum(case when kind='payment' then amount else -amount end),0),
    'payments',count(*) filter(where kind='payment'),
    'refunds',count(*) filter(where kind='refund'),
    'reversals',count(*) filter(where kind='reversal')
  ) into result
  from public.order_payment_movements
  where (from_ts is null or confirmed_at>=from_ts)
    and (to_ts is null or confirmed_at<to_ts);
  return result;
end $fn$;
revoke all on function public.admin_payment_collections_summary(timestamptz,timestamptz) from public,anon;
grant execute on function public.admin_payment_collections_summary(timestamptz,timestamptz) to authenticated;

-- Verificación posterior a supabase/full_setup.sql
-- Este archivo es de solo lectura y puede ejecutarse desde SQL Editor.

select 'business_config' as object, count(*)::text as value from public.business_config
union all select 'payment_methods', count(*)::text from public.payment_methods
union all select 'categories', count(*)::text from public.categories where deleted_at is null
union all select 'ingredients', count(*)::text from public.ingredients where deleted_at is null
union all select 'products', count(*)::text from public.products where deleted_at is null
union all select 'product_ingredients', count(*)::text from public.product_ingredients
union all select 'orders', count(*)::text from public.orders
order by object;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
  and p.proname in (
    'create_public_order',
    'calculate_delivery_quote',
    'get_dashboard_stats',
    'is_business_open',
    'sync_product_ingredients',
    'is_admin'
  )
order by n.nspname, p.proname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('product-images', 'business-assets')
order by id;

select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'orders', 'products', 'categories', 'ingredients',
    'product_ingredients', 'business_config', 'payment_methods'
  )
order by tablename;

select
  c.name as category,
  count(p.id) as products
from public.categories c
left join public.products p on p.category_id = c.id and p.deleted_at is null
where c.deleted_at is null
group by c.id, c.name, c.display_order
order by c.display_order;

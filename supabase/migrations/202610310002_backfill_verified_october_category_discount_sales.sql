-- Asocia las primeras 5 líneas de la campaña 25% de octubre a su campaña.
-- Son pedidos de 30/10/2026 confirmados en web antes de que existiera el snapshot.
-- Solo se asocian si la categoría, fecha y el precio efectivamente cobrado
-- coinciden con la campaña y el precio del catálogo consultado al verificar.
-- El precio cobrado, la cantidad, el total y el ahorro histórico NO se alteran.
-- No rellenar original_unit_price: el precio de lista original no fue almacenado.
update public.order_items oi
set
  discount_campaign_id = c.id,
  discount_campaign_title = c.title,
  discount_percent = c.discount_percent
from public.orders o, public.products p, public.category_discount_campaigns c
where oi.order_id = o.id
  and oi.product_id = p.id
  and oi.category_id = p.category_id
  and oi.is_promotion = true
  and oi.discount_campaign_id is null
  and oi.original_unit_price is null
  and o.source = 'web'
  and o.status <> 'cancelado'
  and o.order_code in ('LCB-261030-000269','LCB-261030-000270','LCB-261030-000271','LCB-261030-000273')
  and oi.id in (
    'c4f83aa9-bf85-4b3b-9ab9-767fd7ea58fa',
    'f0a88656-e0e0-419d-92a8-6306328c92d8',
    '83c4ae98-13a7-46b2-af8d-14e239df0129',
    'f8899747-19de-4d52-94b9-6976a837e320',
    'e2b45607-01dc-466d-832c-a7b87f045820'
  )
  and c.title = '25% Off en hamburguesas'
  and c.discount_percent = 25
  and oi.category_id = any(c.category_ids)
  and (o.created_at at time zone 'America/Argentina/Cordoba')::date
      between c.starts_on and c.ends_on
  and oi.unit_price = round(p.current_price * (1 - c.discount_percent / 100), 0)
  and p.current_price > oi.unit_price;

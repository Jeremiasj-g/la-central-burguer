-- Almacenar precios y campaña tal como se cobraron, sin alterar los pedidos anteriores.
alter table public.order_items
  add column if not exists discount_campaign_id uuid,
  add column if not exists discount_campaign_title text,
  add column if not exists discount_percent numeric(5,2),
  add column if not exists original_unit_price numeric;

comment on column public.order_items.discount_campaign_id is 'ID histórico de la campaña aplicada (sin FK para preservar campañas eliminadas).';
comment on column public.order_items.discount_campaign_title is 'Nombre de campaña al confirmar el pedido.';
comment on column public.order_items.discount_percent is 'Porcentaje aplicado al confirmar el pedido, no el porcentaje actual.';
comment on column public.order_items.original_unit_price is 'Precio de lista por unidad cuando se confirmó el pedido. NULL para históricos sin información.';

create or replace function public.capture_order_item_category_discount()
returns trigger language plpgsql security invoker
set search_path = public
as $function$
declare
  base_price numeric;
  product_category uuid;
  selected_campaign record;
begin
  -- Registrar únicamente descuentos comprobables, no atribuir promociones
  -- manuales/is_promotion a una campaña por categoría.
  new.discount_campaign_id := null;
  new.discount_campaign_title := null;
  new.discount_percent := null;
  new.original_unit_price := null;

  if new.product_id is null or new.category_id is null or new.unit_price is null then
    return new;
  end if;

  select p.current_price, p.category_id
    into base_price, product_category
    from public.products p
    where p.id = new.product_id;

  if not found or product_category is distinct from new.category_id
    or base_price <= new.unit_price then
    return new;
  end if;

  select c.id, c.title, c.discount_percent
    into selected_campaign
    from public.category_discount_campaigns c
    where c.enabled = true
      and new.category_id = any(c.category_ids)
      and c.starts_on <= public.business_local_date()
      and c.ends_on >= public.business_local_date()
    order by c.discount_percent desc, c.created_at asc, c.id asc
    limit 1;

  if not found then return new; end if;

  -- Debe coincidir exactamente con el precio que se cobró desde la RPC;
  -- de otro modo NO se atribuye una campaña ni se inventa un ahorro.
  if new.unit_price <> round(base_price * (1 - selected_campaign.discount_percent / 100), 0) then
    return new;
  end if;

  new.discount_campaign_id := selected_campaign.id;
  new.discount_campaign_title := selected_campaign.title;
  new.discount_percent := selected_campaign.discount_percent;
  new.original_unit_price := base_price;
  new.is_promotion := true;
  return new;
end;
$function$;

drop trigger if exists capture_order_item_category_discount on public.order_items;
create trigger capture_order_item_category_discount
before insert on public.order_items
for each row execute function public.capture_order_item_category_discount();

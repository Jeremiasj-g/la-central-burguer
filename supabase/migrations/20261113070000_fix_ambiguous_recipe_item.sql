-- Corrige SQLSTATE 42702: la variable PL/pgSQL «item» colisionaba
-- con el alias de JSON dentro de sync_product_recipe.
-- Conserva la misma seguridad, validaciones, guardado atómico y permisos.
-- No modifica ingredientes, productos ni recetas existentes.

CREATE OR REPLACE FUNCTION public.sync_product_recipe(target_product_id uuid, ingredient_rows jsonb DEFAULT '[]'::jsonb, component_rows jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  recipe_row record;
  seen_ids uuid[];
  current_id uuid;
begin
  if not private.is_admin() then
    raise exception 'No autorizado.' using errcode='42501';
  end if;
  if jsonb_typeof(ingredient_rows) <> 'array'
     or jsonb_typeof(component_rows) <> 'array' then
    raise exception 'La receta no es válida.' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(4573134);
  perform 1 from public.products p
    where p.id=target_product_id and p.deleted_at is null for update;
  if not found then
    raise exception 'Producto no encontrado.' using errcode='P0001';
  end if;

  -- Validaciones previas: sin duplicados, sin autoconsumo y sin ciclos.
  if exists (
    select 1 from (
      select recipe_element->>'ingredientId' as id
      from jsonb_array_elements(ingredient_rows) recipe_element
    ) x
    group by id having count(*)>1
  ) then raise exception 'No repitas un ingrediente en la receta.'; end if;
  if exists (
    select 1 from (
      select recipe_element->>'productId' as id
      from jsonb_array_elements(component_rows) recipe_element
    ) x
    group by id having count(*)>1
  ) then raise exception 'No repitas un producto en la receta.'; end if;

  for recipe_row in select value as data, ordinality as pos
                from jsonb_array_elements(ingredient_rows) with ordinality
  loop
    if not exists (select 1 from public.ingredients i
      where i.id::text=recipe_row.data->>'ingredientId' and i.deleted_at is null) then
      raise exception 'Uno de los ingredientes no existe o fue eliminado.';
    end if;
  end loop;

  for recipe_row in select value as data, ordinality as pos
                from jsonb_array_elements(component_rows) with ordinality
  loop
    current_id := (recipe_row.data->>'productId')::uuid;
    if current_id=target_product_id then
      raise exception 'Una receta no puede contenerse a sí misma.';
    end if;
    if not exists (
      select 1 from public.products p where p.id=current_id
        and p.deleted_at is null
    ) then raise exception 'Uno de los productos está eliminado.'; end if;
    if coalesce((recipe_row.data->>'quantity')::numeric,0)<=0 then
      raise exception 'Indicá una cantidad mayor que cero para los productos.';
    end if;
    -- Un componente no puede depender directa ni indirectamente del padre.
    with recursive dependency(id,path) as (
      select current_id, array[current_id]
      union all
      select pc.component_product_id,d.path||pc.component_product_id
        from dependency d
        join public.product_recipe_components pc on pc.product_id=d.id
       where not pc.component_product_id=any(d.path)
         and cardinality(d.path)<22
    )
    select array_agg(distinct id) into seen_ids from dependency;
    if target_product_id=any(seen_ids) then
      raise exception 'La combinación genera una dependencia circular entre productos.';
    end if;
    if private.recipe_cost_unit(current_id) is null then
      raise exception 'Solo podés usar productos con receta y costo completos.';
    end if;
  end loop;

  delete from public.product_ingredients where product_id=target_product_id;
  insert into public.product_ingredients(product_id,ingredient_id,quantity,unit,display_order)
  select target_product_id, i.id,
         case when nullif(recipe_element->>'quantity','') is null or
                   (recipe_element->>'quantity')::numeric<=0 then null
              else (recipe_element->>'quantity')::numeric end,
         coalesce(nullif(recipe_element->>'unit','')::public.ingredient_unit,i.unit),
         (ordinality-1)::integer
  from jsonb_array_elements(ingredient_rows) with ordinality as rows(recipe_element,ordinality)
  join public.ingredients i on i.id::text=recipe_element->>'ingredientId';

  delete from public.product_recipe_components where product_id=target_product_id;
  insert into public.product_recipe_components(product_id,component_product_id,quantity,display_order)
  select target_product_id,(recipe_element->>'productId')::uuid,
         (recipe_element->>'quantity')::numeric,(ordinality-1)::integer
  from jsonb_array_elements(component_rows) with ordinality as rows(recipe_element,ordinality);
end;
$function$;

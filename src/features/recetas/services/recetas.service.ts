import type { ProductRecipe, RecipeIngredient, RecipeProductComponent, UpdateRecipeInput } from '../types/receta.types';
import { isSupabaseConfigured, requireSupabaseConfigured } from '@/lib/config/env';
import { createSharedRealtimeSubscription } from '@/lib/supabase/realtime-subscription';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { IngredientUnit } from '@/features/ingredientes/types/ingrediente.types';

type IngredientDbRow = {
  id: string; product_id: string; ingredient_id: string;
  quantity: number | null; unit: IngredientUnit | null; display_order: number;
};

type ComponentDbRow = {
  id: string; product_id: string; component_product_id: string;
  quantity: number; display_order: number;
};

function groupRows(ingredients: IngredientDbRow[], components: ComponentDbRow[]): ProductRecipe[] {
  const grouped = new Map<string, ProductRecipe>();
  const recipeFor = (productId: string) => {
    const existing = grouped.get(productId);
    if (existing) return existing;
    const created: ProductRecipe = {
      id: `recipe-${productId}`, productId,
      ingredients: [], components: [], packagingCost: 0, extraCost: 0,
    };
    grouped.set(productId, created);
    return created;
  };

  for (const row of ingredients) {
    const recipe = recipeFor(row.product_id);
    recipe.ingredients.push({
      id: row.id,
      productId: row.product_id,
      ingredientId: row.ingredient_id,
      quantity: Number(row.quantity ?? 0),
      unit: row.unit ?? 'unidad',
    });
  }
  for (const row of components) {
    const recipe = recipeFor(row.product_id);
    recipe.components.push({
      id: row.id, productId: row.product_id,
      componentProductId: row.component_product_id, quantity: Number(row.quantity),
    });
  }
  return [...grouped.values()];
}

export async function getRecetas(): Promise<ProductRecipe[]> {
  requireSupabaseConfigured('consultar las recetas');
  const client = getSupabaseBrowserClient();
  const [ingredientResponse, componentResponse] = await Promise.all([
    client.from('product_ingredients').select('*').order('product_id').order('display_order'),
    client.from('product_recipe_components').select('*').order('product_id').order('display_order'),
  ]);
  if (ingredientResponse.error) throw new Error(ingredientResponse.error.message);
  if (componentResponse.error) throw new Error(componentResponse.error.message);
  return groupRows(
    (ingredientResponse.data ?? []) as IngredientDbRow[],
    (componentResponse.data ?? []) as ComponentDbRow[],
  );
}

export async function getRecetaByProductoId(productId: string): Promise<ProductRecipe | null> {
  requireSupabaseConfigured('consultar la composición del producto');
  const client = getSupabaseBrowserClient();
  const [ingredientResponse, componentResponse] = await Promise.all([
    client.from('product_ingredients').select('*').eq('product_id',productId).order('display_order'),
    client.from('product_recipe_components').select('*').eq('product_id',productId).order('display_order'),
  ]);
  if (ingredientResponse.error) throw new Error(ingredientResponse.error.message);
  if (componentResponse.error) throw new Error(componentResponse.error.message);
  return groupRows(
    (ingredientResponse.data ?? []) as IngredientDbRow[],
    (componentResponse.data ?? []) as ComponentDbRow[],
  )[0] ?? null;
}

export async function updateProductoReceta(input: UpdateRecipeInput): Promise<ProductRecipe> {
  requireSupabaseConfigured('actualizar la composición del producto');
  const { error } = await getSupabaseBrowserClient().rpc('sync_product_recipe', {
    target_product_id: input.productId,
    ingredient_rows: input.ingredients.map((ingredient, index) => ({
      ingredientId: ingredient.ingredientId,
      quantity: ingredient.quantity || null,
      unit: ingredient.unit,
      displayOrder: index,
    })),
    component_rows: input.components.map((component, index) => ({
      productId: component.componentProductId,
      quantity: component.quantity,
      displayOrder: index,
    })),
  });
  if (error) throw new Error(error.message);
  return { id: `recipe-${input.productId}`, ...input };
}

/** Solo reconstruye costos históricos faltantes, tras confirmación expresa del administrador. */
export async function recoverMissingProductCosts(productId: string): Promise<number> {
  requireSupabaseConfigured('recuperar costos pendientes');
  const { data, error } = await getSupabaseBrowserClient().rpc('admin_backfill_product_recipe_costs', {
    target_product_id: productId,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function ensureRecipeFromIngredientIds(
  productId: string,
  ingredientIds: string[],
): Promise<ProductRecipe> {
  const existing = await getRecetaByProductoId(productId);
  const byIngredient = new Map(
    (existing?.ingredients ?? []).map((item) => [item.ingredientId, item]),
  );
  const ingredients: RecipeIngredient[] = ingredientIds.map(
    (ingredientId) =>
      byIngredient.get(ingredientId) ?? {
        id: crypto.randomUUID(),
        productId,
        ingredientId,
        quantity: 0,
        unit: 'unidad' as const,
      },
  );
  return updateProductoReceta({
    productId, ingredients, components: existing?.components ?? [],
    packagingCost: existing?.packagingCost ?? 0,
    extraCost: existing?.extraCost ?? 0,
  });
}

const subscribeRecipesRealtime = createSharedRealtimeSubscription(
  'catalog-product-recipes',
  (channel, notifyListeners) =>
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_ingredients' }, notifyListeners)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_recipe_components' }, notifyListeners),
);

export function subscribeToRecipes(onChange: () => void) {
  if (!isSupabaseConfigured()) return () => undefined;
  return subscribeRecipesRealtime(onChange);
}

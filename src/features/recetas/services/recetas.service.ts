import type { ProductRecipe, RecipeIngredient, UpdateRecipeInput } from '../types/receta.types';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { IngredientUnit } from '@/features/ingredientes/types/ingrediente.types';

type RecipeDbRow = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number | null;
  unit: IngredientUnit | null;
  display_order: number;
};

function groupRows(rows: RecipeDbRow[]): ProductRecipe[] {
  const grouped = new Map<string, ProductRecipe>();

  for (const row of rows) {
    const recipe = grouped.get(row.product_id) ?? {
      id: `recipe-${row.product_id}`,
      productId: row.product_id,
      ingredients: [],
      packagingCost: 0,
      extraCost: 0,
    };

    recipe.ingredients.push({
      id: row.id,
      productId: row.product_id,
      ingredientId: row.ingredient_id,
      quantity: Number(row.quantity ?? 0),
      unit: row.unit ?? 'unidad',
    });
    grouped.set(row.product_id, recipe);
  }

  return [...grouped.values()];
}

export async function getRecetas(): Promise<ProductRecipe[]> {
  requireSupabaseConfigured('consultar las recetas');

  const { data, error } = await getSupabaseBrowserClient()
    .from('product_ingredients')
    .select('*')
    .order('product_id')
    .order('display_order');

  if (error) throw new Error(error.message);
  return groupRows((data ?? []) as RecipeDbRow[]);
}

export async function getRecetaByProductoId(productId: string): Promise<ProductRecipe | null> {
  requireSupabaseConfigured('consultar la composición del producto');

  const { data, error } = await getSupabaseBrowserClient()
    .from('product_ingredients')
    .select('*')
    .eq('product_id', productId)
    .order('display_order');

  if (error) throw new Error(error.message);
  return groupRows((data ?? []) as RecipeDbRow[])[0] ?? null;
}

export async function updateProductoReceta(input: UpdateRecipeInput): Promise<ProductRecipe> {
  requireSupabaseConfigured('actualizar la composición del producto');

  const { error } = await getSupabaseBrowserClient().rpc('sync_product_ingredients', {
    target_product_id: input.productId,
    ingredient_rows: input.ingredients.map((ingredient, index) => ({
      ingredientId: ingredient.ingredientId,
      quantity: ingredient.quantity || null,
      unit: ingredient.unit,
      displayOrder: index,
    })),
  });

  if (error) throw new Error(error.message);
  return { id: `recipe-${input.productId}`, ...input };
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
    productId,
    ingredients,
    packagingCost: existing?.packagingCost ?? 0,
    extraCost: existing?.extraCost ?? 0,
  });
}

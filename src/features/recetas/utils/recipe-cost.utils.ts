import type { Ingredient } from '@/features/ingredientes/types/ingrediente.types';
import type { Product } from '@/features/productos/types/producto.types';
import type { ProductRecipe, RecipeIngredient, RecipeProductComponent } from '../types/receta.types';

export type RecipeCostResult = { cost: number; complete: boolean };

function baseQuantity(quantity: number, unit: RecipeIngredient['unit'], baseUnit: Ingredient['unit']): number | null {
  if (unit === baseUnit) return quantity;
  if (baseUnit === 'kg' && unit === 'gr') return quantity / 1000;
  if (baseUnit === 'gr' && unit === 'kg') return quantity * 1000;
  if (baseUnit === 'litro' && unit === 'ml') return quantity / 1000;
  if (baseUnit === 'ml' && unit === 'litro') return quantity * 1000;
  return null;
}

export function ingredientLineCost(row: RecipeIngredient, ingredient?: Ingredient): number | null {
  if (!ingredient || row.quantity <= 0 || !Number.isFinite(row.quantity) || ingredient.unitCost <= 0) return null;
  const normalized = baseQuantity(row.quantity, row.unit, ingredient.unit);
  return normalized === null ? null : normalized * ingredient.unitCost;
}

export function draftRecipeCost(
  ingredients: RecipeIngredient[],
  components: RecipeProductComponent[],
  ingredientById: Map<string, Ingredient>,
  knownCosts: Map<string, RecipeCostResult>,
): RecipeCostResult {
  if (ingredients.length + components.length === 0) return { cost: 0, complete: false };
  let total = 0;
  let complete = true;
  for (const row of ingredients) {
    const line = ingredientLineCost(row, ingredientById.get(row.ingredientId));
    if (line === null || line <= 0) complete = false;
    else total += line;
  }
  for (const component of components) {
    const cost = knownCosts.get(component.componentProductId);
    if (!Number.isFinite(component.quantity) || component.quantity <= 0 || !cost?.complete || cost.cost <= 0) {
      complete = false;
    } else total += component.quantity * cost.cost;
  }
  return { cost: total, complete };
}

/** Costo recursivo de recetas guardadas, con protección ante referencias circulares. */
export function buildProductRecipeCosts(
  products: Product[],
  recipes: Map<string, ProductRecipe>,
  ingredients: Map<string, Ingredient>,
): Map<string, RecipeCostResult> {
  const byId = new Map(products.map(product => [product.id, product]));
  const cache = new Map<string, RecipeCostResult>();
  const visit = (productId: string, path: Set<string>): RecipeCostResult => {
    if (!byId.has(productId) || path.has(productId) || path.size >= 20) return { cost: 0, complete: false };
    const cached = cache.get(productId);
    if (cached) return cached;
    const recipe = recipes.get(productId);
    const ingredientRows = recipe?.ingredients ?? (byId.get(productId)?.ingredientIds ?? []).map(ingredientId => ({
      id: `${productId}-${ingredientId}`, productId, ingredientId, quantity: 0,
      unit: ingredients.get(ingredientId)?.unit ?? 'unidad' as const,
    }));
    const components = recipe?.components ?? [];
    const nextPath = new Set(path);
    nextPath.add(productId);
    const childCosts = new Map(components.map(row => [
      row.componentProductId,
      visit(row.componentProductId, nextPath),
    ]));
    const result = draftRecipeCost(ingredientRows, components, ingredients, childCosts);
    cache.set(productId, result);
    return result;
  };
  for (const product of products) visit(product.id, new Set());
  return cache;
}

/** Impide que el producto padre llegue a referenciarse indirectamente. */
export function wouldCreateRecipeCycle(
  parentId: string,
  candidateId: string,
  recipes: Map<string, ProductRecipe>,
): boolean {
  const explored = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === parentId) return true;
    if (explored.has(id)) return false;
    explored.add(id);
    return (recipes.get(id)?.components ?? []).some(item => visit(item.componentProductId));
  };
  return visit(candidateId);
}

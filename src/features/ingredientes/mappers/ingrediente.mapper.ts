import type { Ingredient, IngredientRow } from '../types/ingrediente.types';

export function mapIngredientRowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Ingredient['type'],
    unit: row.unit,
    supplier: row.supplier ?? undefined,
    active: row.active,
    lastUpdatedAt: row.last_updated_at,
  };
}

export function mapIngredientToRow(ingredient: Ingredient): IngredientRow {
  return {
    id: ingredient.id,
    name: ingredient.name,
    type: ingredient.type,
    unit: ingredient.unit,
    supplier: ingredient.supplier ?? null,
    active: ingredient.active,
    last_updated_at: ingredient.lastUpdatedAt,
  };
}

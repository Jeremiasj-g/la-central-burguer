import type { Ingredient, IngredientRow } from '../types/ingrediente.types';

export function mapIngredientRowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Ingredient['type'],
    unit: row.unit,
    unitCost: Number(row.unit_cost ?? 0),
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
    unit_cost: ingredient.unitCost,
    supplier: ingredient.supplier ?? null,
    active: ingredient.active,
    last_updated_at: ingredient.lastUpdatedAt,
  };
}

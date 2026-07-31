import type { IngredientUnit } from '@/features/ingredientes/types/ingrediente.types';

export interface RecipeIngredient {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
}

export interface ProductRecipe {
  id: string;
  productId: string;
  ingredients: RecipeIngredient[];
  packagingCost: number;
  extraCost: number;
}

export interface UpdateRecipeInput {
  productId: string;
  ingredients: RecipeIngredient[];
  packagingCost: number;
  extraCost: number;
}

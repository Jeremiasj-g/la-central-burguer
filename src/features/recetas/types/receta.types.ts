import type { IngredientUnit } from '@/features/ingredientes/types/ingrediente.types';

export interface RecipeIngredient {
  id: string;
  productId: string;
  ingredientId: string;
  quantity: number;
  unit: IngredientUnit;
}

/** Producto final incorporado en una receta (cantidad en unidades). */
export interface RecipeProductComponent {
  id: string;
  productId: string;
  componentProductId: string;
  quantity: number;
}

export interface ProductRecipe {
  id: string;
  productId: string;
  ingredients: RecipeIngredient[];
  components: RecipeProductComponent[];
  packagingCost: number;
  extraCost: number;
}

export interface UpdateRecipeInput {
  productId: string;
  ingredients: RecipeIngredient[];
  components: RecipeProductComponent[];
  packagingCost: number;
  extraCost: number;
}

export type IngredientUnit = 'kg' | 'gr' | 'unidad' | 'litro' | 'ml' | 'paquete';

export interface Ingredient {
  id: string;
  name: string;
  type: 'proteina' | 'panificados' | 'lacteos' | 'verduras' | 'insumos' | 'bebidas' | 'otros';
  unit: IngredientUnit;
  supplier?: string;
  active: boolean;
  lastUpdatedAt: string;
}

export interface IngredientRow {
  id: string;
  name: string;
  type: string;
  unit: IngredientUnit;
  supplier: string | null;
  active: boolean;
  last_updated_at: string;
}

export interface CreateIngredientInput {
  name: string;
  type: Ingredient['type'];
  unit: IngredientUnit;
  supplier?: string;
  active?: boolean;
}

export interface UpdateIngredientInput extends Partial<CreateIngredientInput> {
  id: string;
}

export interface IngredientFilters {
  search?: string;
  type?: 'all' | Ingredient['type'];
  active?: 'all' | 'active' | 'inactive';
}

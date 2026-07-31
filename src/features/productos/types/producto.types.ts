export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  currentPrice: number;
  active: boolean;
  available: boolean;
  featured: boolean;
  isPromotion?: boolean;
  ingredientIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  image_path: string | null;
  category_id: string;
  current_price: number;
  active: boolean;
  available: boolean;
  featured: boolean;
  is_promotion: boolean;
  ingredient_ids?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  description: string;
  imageUrl: string;
  categoryId: string;
  currentPrice: number;
  active?: boolean;
  available?: boolean;
  featured?: boolean;
  isPromotion?: boolean;
  ingredientIds?: string[];
}

export interface UpdateProductInput extends Partial<CreateProductInput> {
  id: string;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  active?: 'all' | 'active' | 'inactive';
  available?: 'all' | 'available' | 'unavailable';
  featured?: boolean;
}

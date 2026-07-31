import type { Product, ProductRow } from '../types/producto.types';

export function mapProductRowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    categoryId: row.category_id,
    currentPrice: row.current_price,
    active: row.active,
    available: row.available,
    featured: row.featured,
    isPromotion: row.is_promotion,
    ingredientIds: row.ingredient_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

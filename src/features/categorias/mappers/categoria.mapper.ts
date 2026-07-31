import type { Category, CategoryRow } from '../types/categoria.types';

export function mapCategoryRowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    iconName: row.icon_name ?? undefined,
    imageUrl: row.image_url ?? undefined,
    order: row.display_order,
    active: row.active,
  };
}

export function mapCategoryToRow(category: Category): CategoryRow {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    icon_name: category.iconName ?? null,
    image_url: category.imageUrl ?? null,
    display_order: category.order,
    active: category.active,
  };
}

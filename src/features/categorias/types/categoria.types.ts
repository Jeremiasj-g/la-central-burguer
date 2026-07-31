export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  imageUrl?: string;
  order: number;
  active: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  image_url: string | null;
  display_order: number;
  active: boolean;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  iconName?: string;
  imageUrl?: string;
  order?: number;
  active?: boolean;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  id: string;
}

export interface CategoryFilters {
  search?: string;
  active?: 'all' | 'active' | 'inactive';
}

export interface CategoryDiscountCampaign {
  id: string;
  title: string;
  category_id: string;
  discount_percent: number;
  starts_on: string;
  ends_on: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryDiscountInput = Pick<
  CategoryDiscountCampaign,
  'title' | 'category_id' | 'discount_percent' | 'starts_on' | 'ends_on' | 'enabled'
>;

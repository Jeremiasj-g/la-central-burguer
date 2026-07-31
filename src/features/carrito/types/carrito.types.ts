export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string;
  categoryName?: string;
  unitPrice: number;
  quantity: number;
  note?: string;
}

export interface CartTotals {
  subtotal: number;
  deliveryCost: number;
  total: number;
}

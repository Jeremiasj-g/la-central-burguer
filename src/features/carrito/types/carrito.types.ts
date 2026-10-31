export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string;
  categoryName?: string;
  unitPrice: number;
  /** Precio de lista por unidad, antes de descuentos temporales. */
  originalUnitPrice?: number;
  discountPercent?: number;
  quantity: number;
  note?: string;
}

export interface CartTotals {
  subtotal: number;
  originalSubtotal: number;
  savings: number;
  deliveryCost: number;
  total: number;
}

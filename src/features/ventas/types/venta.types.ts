import type { DeliveryMethod, PaymentMethodType } from '@/features/checkout/types/checkout.types';
import type { OrderStatus } from '@/features/pedidos/types/pedido.types';
export interface SaleLedgerEntry { id: string; orderCode: string; customerName: string; customerPhone: string; deliveryMethod: DeliveryMethod; paymentMethod: PaymentMethodType; subtotal: number; deliveryCost: number; total: number; status: OrderStatus; createdAt: string; updatedAt: string; }
export interface SaleFilters { search?: string; deliveryMethod?: 'all' | DeliveryMethod; paymentMethod?: 'all' | PaymentMethodType; }

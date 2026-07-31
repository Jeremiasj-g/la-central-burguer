import type { DeliveryMethod, PaymentMethodType } from '@/features/checkout/types/checkout.types';

export type OrderStatus = 'pendiente' | 'aceptado' | 'en_preparacion' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  note?: string;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  date: string;
  description: string;
}

export interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMethod: DeliveryMethod;
  address?: string;
  customerLat?: number;
  customerLng?: number;
  deliveryDistanceKm?: number;
  deliveryMapsUrl?: string;
  paymentMethod: PaymentMethodType;
  items: OrderItem[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  status: OrderStatus;
  notes?: string;
  timeline: OrderTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMethod: DeliveryMethod;
  address?: string;
  customerLat?: number;
  customerLng?: number;
  deliveryDistanceKm?: number;
  deliveryMapsUrl?: string;
  paymentMethod: PaymentMethodType;
  notes?: string;
}

export interface OrderFilters {
  search?: string;
  status?: 'all' | OrderStatus;
}

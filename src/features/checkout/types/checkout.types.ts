import type { GeoPoint } from '@/features/delivery/types/delivery.types';

export type DeliveryMethod = 'retiro_local' | 'delivery';
export type PaymentMethodType = 'efectivo' | 'transferencia';

export interface CheckoutFormValues {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address?: string;
  customerLocation?: GeoPoint | null;
  deliveryDistanceKm?: number;
  deliveryCost?: number;
  deliveryMapsUrl?: string;
  paymentMethod: PaymentMethodType;
  notes?: string;
}

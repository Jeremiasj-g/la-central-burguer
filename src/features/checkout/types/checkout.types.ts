import type {
  DeliveryRouteProvider,
  DeliveryTravelMode,
  GeoPoint,
} from '@/features/delivery/types/delivery.types';

export type DeliveryMethod = 'retiro_local' | 'delivery';
export type PaymentMethodType = 'efectivo' | 'transferencia';

export interface CheckoutFormValues {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  address?: string;
  customerLocation?: GeoPoint | null;
  deliveryDistanceKm?: number;
  deliveryStraightDistanceKm?: number;
  deliveryRouteDurationSeconds?: number | null;
  deliveryRouteDurationText?: string | null;
  deliveryRouteVia?: string | null;
  deliveryRouteProvider?: DeliveryRouteProvider;
  deliveryTravelMode?: DeliveryTravelMode;
  deliveryCost?: number;
  deliveryMapsUrl?: string;
  deliveryQuoteToken?: string;
  deliveryQuoteExpiresAt?: string;
  paymentMethod: PaymentMethodType;
  notes?: string;
}

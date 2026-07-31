export interface PaymentMethod {
  id: string;
  name: string;
  type: 'efectivo' | 'transferencia';
  active: boolean;
}

export interface BusinessConfig {
  businessName: string;
  logoUrl: string;
  logoPath: string | null;
  heroDescription: string;
  whatsappNumber: string;
  transferAlias: string;
  transferCvu: string;
  address: string;
  specialty: string;
  isOpen: boolean;
  autoScheduleEnabled: boolean;
  autoOpenTime: string;
  autoCloseTime: string;
  storeLatitude?: number;
  storeLongitude?: number;
  deliveryBaseFee: number;
  deliveryPricePerKm: number;
  deliveryMaxDistanceKm: number;
  deliveryRoundingValue: number;
  paymentMethods: PaymentMethod[];
}

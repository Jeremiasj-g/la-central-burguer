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
  heroImageUrl: string;
  heroImagePath: string | null;
  heroDescription: string;
  heroTitlePrefix: string;
  heroTitleHighlight: string;
  heroTitleSuffix: string;
  heroPrimaryButtonLabel: string;
  heroSecondaryButtonLabel: string;
  heroImageCaption: string;
  heroServiceLabel: string;
  footerTagline: string;
  footerDescription: string;
  footerLinksHeading: string;
  footerContactHeading: string;
  footerHomeLabel: string;
  footerBestSellersLabel: string;
  footerMenuLabel: string;
  footerCredit: string;
  footerCopyright: string;
  whatsappNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  transferAlias: string;
  transferCvu: string;
  address: string;
  specialty: string;
  timezone: string;
  isOpen: boolean;
  maintenanceMode: boolean;
  autoScheduleEnabled: boolean;
  autoOpenTime: string;
  autoCloseTime: string;
  closedWeekdays: number[];
  dailyHours: Record<string, { open: string; close: string }>;
  storeLatitude?: number;
  storeLongitude?: number;
  deliveryBaseFee: number;
  deliveryPricePerKm: number;
  deliveryMaxDistanceKm: number;
  deliveryRoundingValue: number;
  paymentMethods: PaymentMethod[];
}

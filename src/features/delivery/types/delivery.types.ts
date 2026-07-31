export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryPricingConfig {
  storeLocation: GeoPoint | null;
  baseFee: number;
  pricePerKm: number;
  maxDistanceKm: number;
  roundingValue: number;
}

export interface DeliveryQuote {
  distanceKm: number;
  deliveryCost: number;
  isWithinRange: boolean;
  mapsUrl: string;
}

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

export type DeliveryRouteProvider = 'serpapi_google_maps';
export type DeliveryTravelMode = 'two_wheeler';

export interface DeliveryQuote {
  distanceKm: number;
  routeDistanceKm: number;
  straightDistanceKm: number;
  routeDurationSeconds: number | null;
  routeDurationText: string | null;
  routeVia: string | null;
  routeProvider: DeliveryRouteProvider;
  travelMode: DeliveryTravelMode;
  deliveryCost: number;
  isWithinRange: boolean;
  mapsUrl: string;
  quoteToken: string;
  quoteExpiresAt: string;
}

import type { DeliveryQuote, GeoPoint } from '../types/delivery.types';

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(origin: GeoPoint, destination: GeoPoint): number {
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);

  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(lngDelta / 2) * Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function roundDeliveryCost(value: number, roundingValue: number) {
  const safeRounding = Math.max(roundingValue || 100, 1);
  return Math.ceil(value / safeRounding) * safeRounding;
}

export function calculateDeliveryCost(params: {
  distanceKm: number;
  baseFee: number;
  pricePerKm: number;
  roundingValue: number;
}) {
  const rawCost = Math.max(params.baseFee, 0) + Math.max(params.distanceKm, 0) * Math.max(params.pricePerKm, 0);
  return roundDeliveryCost(rawCost, params.roundingValue);
}

export function buildGoogleMapsUrl(location: GeoPoint) {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}

export function formatDistanceKm(distanceKm: number) {
  return `${distanceKm.toFixed(1)} km`;
}

export function createDeliveryQuote(params: {
  storeLocation: GeoPoint;
  customerLocation: GeoPoint;
  baseFee: number;
  pricePerKm: number;
  maxDistanceKm: number;
  roundingValue: number;
}): DeliveryQuote {
  const distanceKm = calculateDistanceKm(params.storeLocation, params.customerLocation);
  const deliveryCost = calculateDeliveryCost({
    distanceKm,
    baseFee: params.baseFee,
    pricePerKm: params.pricePerKm,
    roundingValue: params.roundingValue,
  });

  return {
    distanceKm,
    deliveryCost,
    isWithinRange: params.maxDistanceKm <= 0 ? true : distanceKm <= params.maxDistanceKm,
    mapsUrl: buildGoogleMapsUrl(params.customerLocation),
  };
}

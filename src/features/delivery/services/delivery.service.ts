import type { DeliveryQuote, GeoPoint } from '../types/delivery.types';
import { requireSupabaseConfigured } from '@/lib/config/env';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface DeliveryQuoteRow {
  distance_km: number | string;
  delivery_cost: number | string;
  is_within_range: boolean;
  maps_url: string;
}

export async function getDeliveryQuote(
  customerLocation: GeoPoint,
): Promise<DeliveryQuote | null> {
  requireSupabaseConfigured('calcular el costo de envío');

  const { data, error } = await getSupabaseBrowserClient().rpc(
    'calculate_delivery_quote',
    {
      customer_lat: customerLocation.lat,
      customer_lng: customerLocation.lng,
    },
  );

  if (error) throw new Error(error.message);

  const row = Array.isArray(data)
    ? data[0] as DeliveryQuoteRow | undefined
    : data as unknown as DeliveryQuoteRow | null;

  if (!row) return null;

  return {
    distanceKm: Number(row.distance_km),
    deliveryCost: Number(row.delivery_cost),
    isWithinRange: row.is_within_range,
    mapsUrl: row.maps_url,
  };
}

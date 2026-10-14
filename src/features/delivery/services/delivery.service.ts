import type { DeliveryQuote, GeoPoint } from '../types/delivery.types';

interface DeliveryQuoteError {
  error?: string;
}

export async function getDeliveryQuote(
  customerLocation: GeoPoint,
): Promise<DeliveryQuote | null> {
  const response = await fetch('/api/delivery/quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      lat: customerLocation.lat,
      lng: customerLocation.lng,
    }),
  });

  const data = await response.json() as DeliveryQuote | DeliveryQuoteError;

  if (!response.ok) {
    throw new Error(
      'error' in data && data.error
        ? data.error
        : 'No pudimos calcular la ruta del delivery.',
    );
  }

  if (!('quoteToken' in data)) return null;
  return data;
}

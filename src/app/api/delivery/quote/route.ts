import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildGoogleMapsUrl,
  calculateDeliveryCost,
  calculateDistanceKm,
} from '@/features/delivery/utils/delivery.utils';
import {
  signDeliveryQuote,
  type SignedDeliveryQuotePayload,
} from '@/features/delivery/server/route-quote.server';

export const runtime = 'nodejs';

const QUOTE_TTL_MS = 20 * 60 * 1000;

interface QuoteRequestBody {
  lat?: number;
  lng?: number;
}

interface SerpApiDirection {
  travel_mode?: string;
  via?: string;
  distance?: number;
  duration?: number;
  formatted_distance?: string;
  formatted_duration?: string;
}

interface SerpApiDirectionsResponse {
  error?: string;
  directions?: SerpApiDirection[];
}

function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function serverErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo calcular la ruta del delivery.';
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as QuoteRequestBody;
    if (!isValidCoordinate(body.lat, -90, 90) || !isValidCoordinate(body.lng, -180, 180)) {
      return NextResponse.json(
        { error: 'La ubicación GPS no es válida.' },
        { status: 400 },
      );
    }

    const serpApiKey = process.env.SERPAPI_API_KEY?.trim() ?? '';
    if (!serpApiKey) {
      throw new Error('SerpApi todavía no está configurado en el servidor.');
    }

    const supabase = getSupabaseAdminClient();
    const { data: config, error: configError } = await supabase
      .from('business_config')
      .select('store_latitude,store_longitude,delivery_base_fee,delivery_price_per_km,delivery_max_distance_km,delivery_rounding_value')
      .eq('id', 1)
      .single();

    if (configError) throw new Error(configError.message);
    if (
      config.store_latitude === null
      || config.store_longitude === null
    ) {
      throw new Error('La ubicación del local no está configurada.');
    }

    const storeLocation = {
      lat: Number(config.store_latitude),
      lng: Number(config.store_longitude),
    };
    const customerLocation = { lat: body.lat, lng: body.lng };
    const straightDistanceKm = calculateDistanceKm(storeLocation, customerLocation);

    const params = new URLSearchParams({
      engine: 'google_maps_directions',
      start_coords: `${storeLocation.lat},${storeLocation.lng}`,
      end_coords: `${customerLocation.lat},${customerLocation.lng}`,
      travel_mode: '9',
      distance_unit: '0',
      hl: 'es',
      gl: 'ar',
      api_key: serpApiKey,
    });

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      throw new Error(`SerpApi respondió con estado ${response.status}.`);
    }

    const result = await response.json() as SerpApiDirectionsResponse;
    if (result.error) throw new Error(result.error);

    const direction = result.directions?.find((item) =>
      item.travel_mode?.toLocaleLowerCase('en').includes('two-wheeler'),
    ) ?? result.directions?.[0];

    if (
      !direction
      || typeof direction.distance !== 'number'
      || !Number.isFinite(direction.distance)
      || direction.distance <= 0
    ) {
      throw new Error('Google Maps no devolvió una ruta válida para esta ubicación.');
    }

    const routeDistanceKm = direction.distance / 1000;
    const deliveryCost = calculateDeliveryCost({
      distanceKm: routeDistanceKm,
      baseFee: Number(config.delivery_base_fee),
      pricePerKm: Number(config.delivery_price_per_km),
      roundingValue: Number(config.delivery_rounding_value),
    });
    const maxDistanceKm = Number(config.delivery_max_distance_km);
    const isWithinRange = maxDistanceKm <= 0 || routeDistanceKm <= maxDistanceKm;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS);
    const mapsUrl = buildGoogleMapsUrl(customerLocation);

    const signedPayload: SignedDeliveryQuotePayload = {
      customerLat: customerLocation.lat,
      customerLng: customerLocation.lng,
      routeDistanceKm,
      straightDistanceKm,
      routeDurationSeconds:
        typeof direction.duration === 'number' && Number.isFinite(direction.duration)
          ? direction.duration
          : null,
      deliveryCost: isWithinRange ? deliveryCost : 0,
      isWithinRange,
      mapsUrl,
      routeProvider: 'serpapi_google_maps',
      travelMode: 'two_wheeler',
      routeVia: direction.via?.trim() || null,
      quotedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json(
      {
        distanceKm: routeDistanceKm,
        routeDistanceKm,
        straightDistanceKm,
        routeDurationSeconds: signedPayload.routeDurationSeconds,
        routeDurationText: direction.formatted_duration ?? null,
        routeVia: signedPayload.routeVia,
        routeProvider: signedPayload.routeProvider,
        travelMode: signedPayload.travelMode,
        deliveryCost: signedPayload.deliveryCost,
        isWithinRange,
        mapsUrl,
        quoteToken: signDeliveryQuote(signedPayload),
        quoteExpiresAt: signedPayload.expiresAt,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: serverErrorMessage(error) },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

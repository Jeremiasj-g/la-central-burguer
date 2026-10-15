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
const ROUTE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ROUTE_CACHE_RADIUS_KM = 0.035;
const STORE_CACHE_RADIUS_KM = 0.02;
const CACHE_SEARCH_DELTA = 0.0006;
const ROUTE_PROVIDER = 'serpapi_google_maps';
const TRAVEL_MODE = 'two_wheeler';
const PUBLIC_DELIVERY_ERROR = 'No pudimos calcular el envío en este momento. Intentá nuevamente.';

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

interface RouteResult {
  routeDistanceKm: number;
  routeDurationSeconds: number | null;
  routeDurationText: string | null;
  routeVia: string | null;
  cacheHit: boolean;
}

function isValidCoordinate(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function routeCacheKey(
  storeLocation: { lat: number; lng: number },
  customerLocation: { lat: number; lng: number },
) {
  return [
    ROUTE_PROVIDER,
    TRAVEL_MODE,
    storeLocation.lat.toFixed(4),
    storeLocation.lng.toFixed(4),
    customerLocation.lat.toFixed(4),
    customerLocation.lng.toFixed(4),
  ].join(':');
}

async function findCachedRoute(
  storeLocation: { lat: number; lng: number },
  customerLocation: { lat: number; lng: number },
): Promise<RouteResult | null> {
  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('delivery_route_cache')
    .select('id,store_latitude,store_longitude,customer_latitude,customer_longitude,route_distance_km,route_duration_seconds,route_via,formatted_duration,hit_count')
    .eq('provider', ROUTE_PROVIDER)
    .eq('travel_mode', TRAVEL_MODE)
    .gt('expires_at', nowIso)
    .gte('store_latitude', storeLocation.lat - CACHE_SEARCH_DELTA)
    .lte('store_latitude', storeLocation.lat + CACHE_SEARCH_DELTA)
    .gte('store_longitude', storeLocation.lng - CACHE_SEARCH_DELTA)
    .lte('store_longitude', storeLocation.lng + CACHE_SEARCH_DELTA)
    .gte('customer_latitude', customerLocation.lat - CACHE_SEARCH_DELTA)
    .lte('customer_latitude', customerLocation.lat + CACHE_SEARCH_DELTA)
    .gte('customer_longitude', customerLocation.lng - CACHE_SEARCH_DELTA)
    .lte('customer_longitude', customerLocation.lng + CACHE_SEARCH_DELTA)
    .order('last_used_at', { ascending: false })
    .limit(30);

  if (error || !data?.length) return null;

  const nearest = data
    .map((row) => {
      const cachedStoreLocation = {
        lat: Number(row.store_latitude),
        lng: Number(row.store_longitude),
      };
      const cachedCustomerLocation = {
        lat: Number(row.customer_latitude),
        lng: Number(row.customer_longitude),
      };

      return {
        row,
        storeDistanceKm: calculateDistanceKm(storeLocation, cachedStoreLocation),
        customerDistanceKm: calculateDistanceKm(customerLocation, cachedCustomerLocation),
      };
    })
    .filter((candidate) =>
      candidate.storeDistanceKm <= STORE_CACHE_RADIUS_KM
      && candidate.customerDistanceKm <= ROUTE_CACHE_RADIUS_KM,
    )
    .sort((left, right) => left.customerDistanceKm - right.customerDistanceKm)[0];

  if (!nearest) return null;

  const usedAt = new Date().toISOString();
  await supabase
    .from('delivery_route_cache')
    .update({
      hit_count: nearest.row.hit_count + 1,
      last_used_at: usedAt,
      updated_at: usedAt,
    })
    .eq('id', nearest.row.id);

  return {
    routeDistanceKm: Number(nearest.row.route_distance_km),
    routeDurationSeconds: nearest.row.route_duration_seconds,
    routeDurationText: nearest.row.formatted_duration,
    routeVia: nearest.row.route_via,
    cacheHit: true,
  };
}

async function saveCachedRoute(
  storeLocation: { lat: number; lng: number },
  customerLocation: { lat: number; lng: number },
  route: Omit<RouteResult, 'cacheHit'>,
) {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  await supabase
    .from('delivery_route_cache')
    .upsert(
      {
        cache_key: routeCacheKey(storeLocation, customerLocation),
        provider: ROUTE_PROVIDER,
        travel_mode: TRAVEL_MODE,
        store_latitude: storeLocation.lat,
        store_longitude: storeLocation.lng,
        customer_latitude: customerLocation.lat,
        customer_longitude: customerLocation.lng,
        route_distance_km: route.routeDistanceKm,
        route_duration_seconds: route.routeDurationSeconds,
        route_via: route.routeVia,
        formatted_duration: route.routeDurationText,
        expires_at: new Date(now.getTime() + ROUTE_CACHE_TTL_MS).toISOString(),
        hit_count: 0,
        last_used_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'cache_key' },
    );
}

async function fetchSerpApiRoute(
  storeLocation: { lat: number; lng: number },
  customerLocation: { lat: number; lng: number },
): Promise<RouteResult> {
  const serpApiKey = process.env.SERPAPI_API_KEY?.trim() ?? '';
  if (!serpApiKey) {
    throw new Error('SerpApi todavía no está configurado en el servidor.');
  }

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

  return {
    routeDistanceKm: direction.distance / 1000,
    routeDurationSeconds:
      typeof direction.duration === 'number' && Number.isFinite(direction.duration)
        ? direction.duration
        : null,
    routeDurationText: direction.formatted_duration ?? null,
    routeVia: direction.via?.trim() || null,
    cacheHit: false,
  };
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

    let route = await findCachedRoute(storeLocation, customerLocation);

    if (!route) {
      route = await fetchSerpApiRoute(storeLocation, customerLocation);
      await saveCachedRoute(storeLocation, customerLocation, {
        routeDistanceKm: route.routeDistanceKm,
        routeDurationSeconds: route.routeDurationSeconds,
        routeDurationText: route.routeDurationText,
        routeVia: route.routeVia,
      });
    }

    const deliveryCost = calculateDeliveryCost({
      distanceKm: route.routeDistanceKm,
      baseFee: Number(config.delivery_base_fee),
      pricePerKm: Number(config.delivery_price_per_km),
      roundingValue: Number(config.delivery_rounding_value),
    });
    const maxDistanceKm = Number(config.delivery_max_distance_km);
    const isWithinRange = maxDistanceKm <= 0 || route.routeDistanceKm <= maxDistanceKm;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS);
    const mapsUrl = buildGoogleMapsUrl(customerLocation);

    const signedPayload: SignedDeliveryQuotePayload = {
      customerLat: customerLocation.lat,
      customerLng: customerLocation.lng,
      routeDistanceKm: route.routeDistanceKm,
      straightDistanceKm,
      routeDurationSeconds: route.routeDurationSeconds,
      deliveryCost: isWithinRange ? deliveryCost : 0,
      isWithinRange,
      mapsUrl,
      routeProvider: ROUTE_PROVIDER,
      travelMode: TRAVEL_MODE,
      routeVia: route.routeVia,
      quotedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json(
      {
        distanceKm: route.routeDistanceKm,
        routeDistanceKm: route.routeDistanceKm,
        straightDistanceKm,
        routeDurationSeconds: signedPayload.routeDurationSeconds,
        routeDurationText: route.routeDurationText,
        routeVia: signedPayload.routeVia,
        routeProvider: signedPayload.routeProvider,
        travelMode: signedPayload.travelMode,
        deliveryCost: signedPayload.deliveryCost,
        isWithinRange,
        mapsUrl,
        quoteToken: signDeliveryQuote(signedPayload),
        quoteExpiresAt: signedPayload.expiresAt,
        routeCacheHit: route.cacheHit,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('[delivery-quote] No se pudo calcular la cotización de delivery.', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: PUBLIC_DELIVERY_ERROR },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

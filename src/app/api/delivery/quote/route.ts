import { NextResponse } from 'next/server';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
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

// EXCLUSIVO DE CHETOS DEV: sin SerpApi, OSRM, Google Directions ni rutas externas.
// El GPS proviene de navigator.geolocation en el checkout; Haversine calcula
// la distancia en línea recta, por lo que no equivale al recorrido por calles.
const DEV_PROJECT_REF = 'xammmicdxyvzdxccnwpq';
const DEV_BRANCH = 'fix/dev-delivery-simulation';
const QUOTE_TTL_MS = 20 * 60 * 1000;
const ROUTE_PROVIDER = 'haversine_gps' as const;
const TRAVEL_MODE = 'two_wheeler' as const;

type QuoteRequestBody = { lat?: unknown; lng?: unknown };
type Point = { lat: number; lng: number };

function isQaEnvironment() {
  return process.env.VERCEL_GIT_COMMIT_REF === DEV_BRANCH
    || process.env.NEXT_PUBLIC_APP_ENV === 'development'
    || process.env.NODE_ENV === 'development';
}

function hasDevDatabaseConnection() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
      === `${DEV_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

function isValidCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
    && value >= minimum && value <= maximum;
}

async function getDeliverySettings() {
  const { data, error } = await getSupabaseBrowserClient()
    .from('business_config')
    .select('store_latitude,store_longitude,delivery_base_fee,delivery_price_per_km,delivery_max_distance_km,delivery_rounding_value')
    .eq('id', 1)
    .single();
  if (error || !data) throw new Error('No pudimos consultar la configuración de envío de Chetos DEV.');

  const rawStoreLat = data.store_latitude;
  const rawStoreLng = data.store_longitude;
  if (rawStoreLat === null || rawStoreLng === null
    || !Number.isFinite(Number(rawStoreLat)) || !Number.isFinite(Number(rawStoreLng))) {
    throw new Error('Configurá la ubicación del local desde el panel de Chetos DEV.');
  }

  const amounts = [
    data.delivery_base_fee, data.delivery_price_per_km,
    data.delivery_max_distance_km, data.delivery_rounding_value,
  ].map(Number);
  if (amounts.some(value => !Number.isFinite(value) || value < 0) || amounts[3] <= 0) {
    throw new Error('La tarifa de envío del local no está configurada correctamente.');
  }

  const storeLocation: Point = { lat: Number(rawStoreLat), lng: Number(rawStoreLng) };
  if (!isValidCoordinate(storeLocation.lat, -90, 90)
    || !isValidCoordinate(storeLocation.lng, -180, 180)) {
    throw new Error('La ubicación configurada del local es inválida.');
  }
  return {
    storeLocation,
    baseFee: amounts[0],
    pricePerKm: amounts[1],
    maxDistanceKm: amounts[2],
    roundingValue: amounts[3],
  };
}

async function verifyDevOrderDatabase() {
  const { data, error } = await getSupabaseAdminClient()
    .from('business_config')
    .select('id')
    .eq('id', 1)
    .single();
  if (error || !data) {
    throw new Error('La clave de servidor de Supabase Preview no permite confirmar pedidos en chetos-dev.');
  }
}

function errorResponse(error: unknown, status = 502) {
  const message = error instanceof Error ? error.message : 'No pudimos calcular el envío.';
  console.error('[chetos-haversine-delivery]', message);
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function assertQaSafety() {
  if (!isQaEnvironment()) {
    throw new Error('Este método de cotización solo está habilitado en la rama de pruebas.');
  }
  // Evita que el checkout DEV use accidentalmente la base de producción.
  if (!hasDevDatabaseConnection()) {
    throw new Error('El despliegue de pruebas no apunta a chetos-dev. Revisá Supabase Preview en Vercel.');
  }
}

export async function GET() {
  try {
    assertQaSafety();
    if (!process.env.DELIVERY_QUOTE_SECRET?.trim()) {
      throw new Error('Falta configurar DELIVERY_QUOTE_SECRET en Vercel Preview.');
    }
    await getDeliverySettings();
    await verifyDevOrderDatabase();
    return NextResponse.json({
      ok: true, code: 'HAVERSINE_GPS_DEV',
      note: 'Geolocation API del navegador y distancia recta; no se consultan rutas por calles.',
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertQaSafety();
    if (!process.env.DELIVERY_QUOTE_SECRET?.trim()) {
      throw new Error('Falta configurar DELIVERY_QUOTE_SECRET en Vercel Preview.');
    }

    let body: QuoteRequestBody;
    try {
      body = await request.json() as QuoteRequestBody;
    } catch {
      return NextResponse.json({ error: 'Enviá una ubicación GPS válida.' }, { status: 400 });
    }
    if (!isValidCoordinate(body.lat, -90, 90)
      || !isValidCoordinate(body.lng, -180, 180)) {
      return NextResponse.json({ error: 'La ubicación GPS no es válida.' }, { status: 400 });
    }

    const settings = await getDeliverySettings();
    await verifyDevOrderDatabase();
    const customerLocation = { lat: body.lat, lng: body.lng };

    // Guardamos la distancia en 3 decimales, como la columna numeric(8,3)
    // y la validación del costo que hace PostgreSQL al crear el pedido.
    const straightDistanceKm = Number(
      calculateDistanceKm(settings.storeLocation, customerLocation).toFixed(3),
    );
    const deliveryCost = calculateDeliveryCost({
      distanceKm: straightDistanceKm,
      baseFee: settings.baseFee,
      pricePerKm: settings.pricePerKm,
      roundingValue: settings.roundingValue,
    });
    const isWithinRange = settings.maxDistanceKm <= 0
      || straightDistanceKm <= settings.maxDistanceKm;
    const mapsUrl = buildGoogleMapsUrl(customerLocation);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS);

    const signed: SignedDeliveryQuotePayload = {
      customerLat: customerLocation.lat,
      customerLng: customerLocation.lng,
      routeDistanceKm: straightDistanceKm,
      straightDistanceKm,
      routeDurationSeconds: null,
      deliveryCost: isWithinRange ? deliveryCost : 0,
      isWithinRange,
      mapsUrl,
      routeProvider: ROUTE_PROVIDER,
      travelMode: TRAVEL_MODE,
      routeVia: 'Distancia directa por GPS (sin cálculo por calles)',
      quotedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return NextResponse.json({
      distanceKm: straightDistanceKm,
      routeDistanceKm: straightDistanceKm,
      straightDistanceKm,
      routeDurationSeconds: null,
      routeDurationText: null,
      routeVia: signed.routeVia,
      routeProvider: signed.routeProvider,
      travelMode: signed.travelMode,
      deliveryCost: signed.deliveryCost,
      isWithinRange,
      mapsUrl,
      quoteToken: signDeliveryQuote(signed),
      quoteExpiresAt: signed.expiresAt,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

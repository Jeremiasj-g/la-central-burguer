import { createHmac, timingSafeEqual } from 'node:crypto';

export type DeliveryRouteProvider = 'serpapi_google_maps';
export type DeliveryTravelMode = 'two_wheeler';

export interface SignedDeliveryQuotePayload {
  customerLat: number;
  customerLng: number;
  routeDistanceKm: number;
  straightDistanceKm: number;
  routeDurationSeconds: number | null;
  deliveryCost: number;
  isWithinRange: boolean;
  mapsUrl: string;
  routeProvider: DeliveryRouteProvider;
  travelMode: DeliveryTravelMode;
  routeVia: string | null;
  quotedAt: string;
  expiresAt: string;
}

function getQuoteSecret() {
  const secret = process.env.DELIVERY_QUOTE_SECRET?.trim() ?? '';
  if (!secret) {
    throw new Error('Falta configurar DELIVERY_QUOTE_SECRET en el servidor.');
  }
  return secret;
}

function encodePayload(payload: SignedDeliveryQuotePayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signEncodedPayload(encodedPayload: string) {
  return createHmac('sha256', getQuoteSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function signDeliveryQuote(payload: SignedDeliveryQuotePayload) {
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${signEncodedPayload(encodedPayload)}`;
}

export function verifyDeliveryQuote(token: string): SignedDeliveryQuotePayload {
  const [encodedPayload, receivedSignature, ...extra] = token.split('.');
  if (!encodedPayload || !receivedSignature || extra.length) {
    throw new Error('La cotización de delivery no es válida.');
  }

  const expectedSignature = signEncodedPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);

  if (
    expectedBuffer.length !== receivedBuffer.length
    || !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error('La cotización de delivery fue modificada. Volvé a calcular el envío.');
  }

  let payload: SignedDeliveryQuotePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SignedDeliveryQuotePayload;
  } catch {
    throw new Error('La cotización de delivery no se pudo leer.');
  }

  if (!payload.expiresAt || Date.now() >= new Date(payload.expiresAt).getTime()) {
    throw new Error('La cotización de delivery venció. Volvé a compartir tu ubicación.');
  }

  return payload;
}

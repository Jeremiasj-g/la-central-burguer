import type { GeoPoint } from '../types/delivery.types';

// La búsqueda del navegador puede fallar en computadoras sin GPS.
// Aceptamos coordenadas elegidas conscientemente por la persona, sin consultar
// acortadores, APIs externas ni interpretar un enlace de mapa como geolocalización.
const COORDINATE_PAIR = /^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*[,;]\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/;

function parseCoordinates(raw: string): GeoPoint | null {
  const match = raw.match(COORDINATE_PAIR);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parseSharedMapLocation(raw: string): GeoPoint | null {
  const text = raw.trim();
  if (!text || text.length > 2000) return null;

  const simplePair = parseCoordinates(text);
  if (simplePair) return simplePair;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || !['google.com', 'www.google.com', 'maps.google.com'].includes(url.hostname)) {
    return null;
  }

  // Enlaces directos generados por Google Maps con un pin en el parámetro de consulta.
  for (const key of ['q', 'query', 'll']) {
    const parameter = url.searchParams.get(key);
    const location = parameter && parseCoordinates(parameter);
    if (location) return location;
  }

  // Enlaces completos a lugares de Maps: !3dLAT!4dLNG identifica el punto,
  // a diferencia de /@LAT,LNG, que solo representa el centro de la pantalla.
  if (url.pathname.startsWith('/maps/')) {
    const match = url.href.match(/!3d([+-]?\d{1,2}(?:\.\d+)?)!4d([+-]?\d{1,3}(?:\.\d+)?)/);
    if (match) return parseCoordinates(`${match[1]},${match[2]}`);
  }

  return null;
}

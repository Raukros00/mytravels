/**
 * Distanze tra punti (latitudine/longitudine) calcolate in locale, senza servizi esterni. Solo funzioni pure.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Vero se il punto ha coordinate numeriche valide. */
export function hasCoords(point: Partial<LatLng> | null | undefined): point is LatLng {
  return !!point
    && typeof point.lat === 'number' && typeof point.lng === 'number'
    && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

/** Distanza in linea d'aria (metri) tra due punti, formula dell'emisenoverso (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m", "1,2 km" (it) / "1.2 km" (en); sotto il km arrotondata ai 10 m, sopra al decimo (oltre 10 km all'unità). */
export function formatDistance(meters: number, lang: 'it' | 'en' = 'it'): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  const digits = km < 10 ? 1 : 0;
  return `${km.toLocaleString(lang === 'en' ? 'en-US' : 'it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

/**
 * Indicazioni per la prossima tappa (#106): link alle app di mappe con i mezzi pubblici già selezionati e stima
 * della distanza e del tempo a piedi tra due tappe, calcolata in locale. Solo funzioni pure.
 *
 * - iPhone/iPad: Apple Maps (`maps.apple.com/?daddr=…&dirflg=r`), con Google Maps come alternativa;
 * - Android e desktop: Google Maps (`google.com/maps/dir/?api=1&destination=…&travelmode=transit`);
 * - Citymapper su richiesta (preferenza salvata sul dispositivo).
 * Senza coordinate si usa l'indirizzo (con il nome). Senza partenza l'app usa la posizione attuale.
 */

import { LatLng, formatDistance, hasCoords, haversineMeters } from './geo.utils';

export type MapsApp = 'apple' | 'google' | 'citymapper';
export type DevicePlatform = 'ios' | 'android' | 'desktop';

export const MAPS_APP_LABELS: Readonly<Record<MapsApp, string>> = {
  apple: 'Apple Maps',
  google: 'Google Maps',
  citymapper: 'Citymapper'
};

/** Velocità media a piedi (km/h) e fattore che allunga la linea d'aria al percorso reale. */
export const WALKING_KMH = 4.8;
export const ROUTE_FACTOR = 1.3;

/** Un luogo per le indicazioni: coordinate se ci sono, altrimenti nome e indirizzo. */
export interface MapPlace {
  name?: string | null;
  address?: string | null;
  coordinates?: Partial<LatLng> | null;
}

/** Piattaforma del dispositivo dallo user agent (gli iPad recenti si presentano come Mac con il touch). */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): DevicePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

/** App di mappe proposte sul dispositivo, la predefinita per prima. */
export function availableMapsApps(platform: DevicePlatform): MapsApp[] {
  return platform === 'ios' ? ['apple', 'google', 'citymapper'] : ['google', 'citymapper'];
}

/** L'app da usare: la preferenza salvata se disponibile sul dispositivo, altrimenti la predefinita. */
export function resolveMapsApp(platform: DevicePlatform, preferred?: string | null): MapsApp {
  const apps = availableMapsApps(platform);
  return apps.includes(preferred as MapsApp) ? (preferred as MapsApp) : apps[0];
}

const coordText = (p: LatLng) => `${round6(p.lat)},${round6(p.lng)}`;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Query string con i valori codificati, lasciando leggibili le virgole (`daddr=41.4,2.17`). */
function query(pairs: [string, string][]): string {
  return pairs.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ',')}`).join('&');
}

/** "Nome, indirizzo" (senza ripetere il nome se l'indirizzo lo contiene già). */
export function placeQuery(place: MapPlace): string {
  const name = place.name?.trim() ?? '';
  const address = place.address?.trim() ?? '';
  if (!address) return name;
  if (!name || address.toLowerCase().includes(name.toLowerCase())) return address;
  return `${name}, ${address}`;
}

/** Vero se il luogo basta per delle indicazioni (coordinate, indirizzo o almeno il nome). */
export function isRoutable(place: MapPlace | null | undefined): place is MapPlace {
  return !!place && (hasCoords(place.coordinates) || !!placeQuery(place));
}

/**
 * Link alle indicazioni con i mezzi pubblici verso `destination`, nell'app `app`. Con `origin` la partenza è quel
 * luogo, altrimenti la posizione attuale (decide l'app).
 */
export function directionsUrl(app: MapsApp, destination: MapPlace, origin?: MapPlace | null): string {
  const from = isRoutable(origin) ? origin : null;
  switch (app) {
    case 'apple': {
      const params: [string, string][] = [];
      if (from) params.push(['saddr', hasCoords(from.coordinates) ? coordText(from.coordinates) : placeQuery(from)]);
      params.push(['daddr', hasCoords(destination.coordinates) ? coordText(destination.coordinates) : placeQuery(destination)]);
      params.push(['dirflg', 'r']);
      return `https://maps.apple.com/?${query(params)}`;
    }
    case 'citymapper': {
      const params: [string, string][] = [];
      if (from) {
        if (hasCoords(from.coordinates)) params.push(['startcoord', coordText(from.coordinates)]);
        else params.push(['startaddress', placeQuery(from)]);
        if (from.name) params.push(['startname', from.name]);
      }
      if (hasCoords(destination.coordinates)) params.push(['endcoord', coordText(destination.coordinates)]);
      else params.push(['endaddress', placeQuery(destination)]);
      if (destination.name) params.push(['endname', destination.name]);
      return `https://citymapper.com/directions?${query(params)}`;
    }
    default: {
      const params: [string, string][] = [['api', '1']];
      if (from) params.push(['origin', hasCoords(from.coordinates) ? coordText(from.coordinates) : placeQuery(from)]);
      params.push(['destination', hasCoords(destination.coordinates) ? coordText(destination.coordinates) : placeQuery(destination)]);
      params.push(['travelmode', 'transit']);
      return `https://www.google.com/maps/dir/?${query(params)}`;
    }
  }
}

export interface WalkEstimate {
  /** Distanza in linea d'aria (metri). */
  meters: number;
  /** Tempo indicativo a piedi (minuti), sul percorso stimato (linea d'aria × `ROUTE_FACTOR`). */
  minutes: number;
}

/** Stima tra due luoghi, solo se entrambi hanno coordinate. */
export function walkEstimate(from: MapPlace | null | undefined, to: MapPlace | null | undefined): WalkEstimate | null {
  if (!hasCoords(from?.coordinates) || !hasCoords(to?.coordinates)) return null;
  const meters = haversineMeters(from!.coordinates as LatLng, to!.coordinates as LatLng);
  const minutes = Math.max(1, Math.round((meters * ROUTE_FACTOR) / (WALKING_KMH * 1000 / 60)));
  return { meters, minutes };
}

/** "1,2 km · ~15 min a piedi" (it) / "1.2 km · ~15 min walk" (en). */
export function formatWalkEstimate(estimate: WalkEstimate, lang: 'it' | 'en' = 'it'): string {
  const h = Math.floor(estimate.minutes / 60);
  const m = estimate.minutes % 60;
  const time = h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  return `${formatDistance(estimate.meters, lang)} · ~${time} ${lang === 'en' ? 'walk' : 'a piedi'}`;
}

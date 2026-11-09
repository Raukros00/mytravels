/**
 * Posizione del telefono nella guida "In viaggio" (#108): funzioni pure per distanza e arrivo.
 * La posizione resta sul dispositivo: nessuna di queste funzioni la invia altrove.
 */
import { LatLng, hasCoords, haversineMeters } from './geo.utils';

/** Entro questa distanza da una tappa si propone "Sei arrivato?". */
export const ARRIVAL_RADIUS_M = 100;
/** Oltre questa incertezza (metri) la posizione è troppo vaga per dire che si è arrivati. */
export const MAX_ARRIVAL_ACCURACY_M = 150;
/** Una posizione più vecchia di così non si usa (es. app rimasta in background). */
export const MAX_POSITION_AGE_MS = 2 * 60 * 1000;

export interface DevicePosition extends LatLng {
  /** Incertezza in metri (dal browser). */
  accuracy: number;
  /** Istante della misura (ms). */
  at: number;
}

/** Tappa candidata all'arrivo. */
export interface ArrivalStop {
  id: string;
  name: string;
  coordinates?: Partial<LatLng> | null;
  done: boolean;
  skipped: boolean;
}

/** Vero se la posizione è abbastanza recente per essere usata. */
export function isFresh(position: DevicePosition | null | undefined, now: number): position is DevicePosition {
  return !!position && now - position.at <= MAX_POSITION_AGE_MS;
}

/** Distanza in metri dalla tappa, `null` se la tappa non ha coordinate. */
export function distanceTo(position: LatLng, coordinates: Partial<LatLng> | null | undefined): number | null {
  return hasCoords(coordinates) ? haversineMeters(position, coordinates) : null;
}

/**
 * La tappa a cui si è arrivati: entro {@link ARRIVAL_RADIUS_M} (con una posizione abbastanza precisa), non ancora
 * fatta né saltata e non già scartata con "No". A parità, prima `preferId` (la tappa in corso o la prossima),
 * poi la più vicina.
 */
export function arrivalAt(
  position: DevicePosition,
  stops: readonly ArrivalStop[],
  dismissed: ReadonlySet<string> = new Set(),
  preferId: string | null = null
): ArrivalStop | null {
  if (position.accuracy > MAX_ARRIVAL_ACCURACY_M) return null;
  const near = stops
    .filter(s => !s.done && !s.skipped && !dismissed.has(s.id))
    .map(s => ({ stop: s, meters: distanceTo(position, s.coordinates) }))
    .filter((c): c is { stop: ArrivalStop; meters: number } => c.meters !== null && c.meters <= ARRIVAL_RADIUS_M)
    .sort((a, b) => (a.stop.id === preferId ? -1 : b.stop.id === preferId ? 1 : a.meters - b.meters));
  return near[0]?.stop ?? null;
}

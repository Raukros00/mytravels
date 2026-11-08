import { TripActivity, TripPlaceToEat } from '../../../core/models/trip.model';
import { ScheduleStop, effectiveTimes, findOverlaps, formatTimeRange, sortDayStops } from '../../../core/utils/day-schedule.utils';

export type DetailTab = 'itinerary' | 'expenses' | 'activities' | 'food' | 'flights' | 'hotel';

export interface TimelineItem {
  id: string;
  type: 'activity' | 'food';
  name: string;
  /** Orario da mostrare ("10:00–12:30"), o il testo libero se non è un orario riconoscibile. */
  timeLabel?: string;
  /** Orario indicativo del pasto, non impostato dall'utente. */
  isDefaultTime?: boolean;
  /** Nomi delle tappe della giornata con orari che si sovrappongono a questa. */
  overlapsWith: string[];
  address?: string;
  notes?: string;
  priceInfo?: string;
  bookingInfo?: string;
  isCompleted?: boolean;
  raw: TripActivity | TripPlaceToEat;
}

export interface AssignDayResult {
  day: number | null;
  startTime: string | null;
  endTime: string | null;
  /** Testo libero (es. "mattina"); con gli orari impostati è la loro forma scritta. */
  timeSlot: string;
}

/** Pasto di un locale: quello assegnato o, in mancanza, la sua categoria (pranzo, cena...). */
export function mealOf(place: TripPlaceToEat): string | null {
  return place.assignedMeal || place.category || null;
}

/**
 * Le tappe del giorno in sequenza (ordine scelto, poi orari; pranzo e cena con l'orario indicativo),
 * con l'etichetta dell'orario e le sovrapposizioni.
 */
export function buildDayTimeline(activities: TripActivity[], places: TripPlaceToEat[], day: number): TimelineItem[] {
  type Stop = ScheduleStop & { item: Omit<TimelineItem, 'timeLabel' | 'isDefaultTime' | 'overlapsWith'> };

  const stops: Stop[] = [
    ...activities.filter(a => a.assignedDay === day).map(a => ({
      id: a.id, name: a.name, startTime: a.startTime, endTime: a.endTime, timeSlot: a.timeSlot, dayOrder: a.dayOrder,
      item: {
        id: a.id,
        type: 'activity' as const,
        name: a.name,
        address: a.address,
        notes: a.notes,
        priceInfo: a.ticketsRequired ? (a.ticketPrice ? `€${a.ticketPrice}` : 'A pagamento') : 'Gratis',
        bookingInfo: a.bookingRequired ? '⚠️ Prenotare' : undefined,
        isCompleted: a.isCompleted,
        raw: a
      }
    })),
    ...places.filter(p => p.assignedDay === day).map(p => ({
      id: p.id, name: p.name, startTime: p.startTime, endTime: p.endTime, timeSlot: p.timeSlot, dayOrder: p.dayOrder,
      assignedMeal: mealOf(p),
      item: {
        id: p.id,
        type: 'food' as const,
        name: p.name,
        address: p.address,
        notes: p.specialties ? `Specialità: ${p.specialties}` : p.notes,
        priceInfo: p.priceRange,
        bookingInfo: p.bookingRequired ? '⚠️ Prenotare' : undefined,
        isCompleted: p.isVisited,
        raw: p
      }
    }))
  ];

  const overlaps = findOverlaps(stops);
  return sortDayStops(stops).map(stop => {
    const times = effectiveTimes(stop);
    return {
      ...stop.item,
      timeLabel: times ? formatTimeRange(times.start, times.end) : (stop.timeSlot?.trim() || undefined),
      isDefaultTime: times?.source === 'meal-default',
      overlapsWith: (overlaps.get(stop.id) ?? []).map(o => o.name)
    };
  });
}

export function getNavigationUrl(name: string, address?: string): string {
  const q = encodeURIComponent(`${name} ${address || ''}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function formatDayDate(startDate: string | undefined, dayNum: number): string {
  if (!startDate) return `Giorno ${dayNum}`;
  const date = new Date(startDate);
  date.setDate(date.getDate() + (dayNum - 1));
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function generateFallbackCoords(destination: string, seed: string): { lat: number; lng: number } {
  let baseLat = 41.3851;
  let baseLng = 2.1734;
  if (destination.toLowerCase().includes('roma')) {
    baseLat = 41.9028;
    baseLng = 12.4964;
  } else if (destination.toLowerCase().includes('tokyo')) {
    baseLat = 35.6762;
    baseLng = 139.6503;
  }

  const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const offsetLat = ((hash % 30) - 15) * 0.003;
  const offsetLng = (((hash * 7) % 30) - 15) * 0.003;

  return { lat: baseLat + offsetLat, lng: baseLng + offsetLng };
}

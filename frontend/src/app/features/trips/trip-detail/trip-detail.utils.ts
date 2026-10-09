import { TripActivity, TripPlaceToEat } from '../../../core/models/trip.model';

export type DetailTab = 'itinerary' | 'expenses' | 'activities' | 'food' | 'flights' | 'hotel';

export interface TimelineItem {
  id: string;
  type: 'activity' | 'food';
  name: string;
  timeSlot?: string;
  address?: string;
  notes?: string;
  priceInfo?: string;
  bookingInfo?: string;
  isCompleted?: boolean;
  raw: TripActivity | TripPlaceToEat;
}

export interface AssignDayResult {
  day: number | null;
  timeSlot: string;
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

export function getMealDefaultTime(category: string): string {
  switch (category) {
    case 'breakfast': return '08:30';
    case 'lunch': return '13:00';
    case 'dinner': return '20:30';
    case 'snack': return '17:00';
    case 'aperitivo': return '19:00';
    default: return '13:00';
  }
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

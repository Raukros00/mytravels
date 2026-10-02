export type TripStatus = 'planning' | 'upcoming' | 'ongoing' | 'completed';

/** 'proposal' = still to be voted by the group; missing value means 'confirmed'. */
export type TripDecision = 'proposal' | 'confirmed';

export type ActivityCategory = 'monument' | 'museum' | 'nature' | 'experience' | 'shopping' | 'other';
export type FoodCategory = 'lunch' | 'dinner' | 'snack' | 'breakfast' | 'aperitivo';
export type PriceRange = '€' | '€€' | '€€€' | '€€€€';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TripActivity {
  id: string;
  tripId: string;
  name: string;
  category: ActivityCategory;
  address: string;
  coordinates?: GeoPoint;
  ticketsRequired: boolean;
  ticketPrice?: number;
  currency?: string;
  bookingRequired: boolean;
  bookingUrl?: string;
  openingHours?: string;
  closingDays?: string;
  notes?: string;
  assignedDay?: number | null; // null = in backlog, number = assigned to Day X
  timeSlot?: string;          // e.g. "10:00 - 12:00"
  isCompleted?: boolean;
}

export interface TripPlaceToEat {
  id: string;
  tripId: string;
  name: string;
  category: FoodCategory;
  priceRange: PriceRange;
  address: string;
  coordinates?: GeoPoint;
  specialties?: string;        // e.g. "Paella de marisco, tapas di polpo"
  bookingRequired: boolean;
  openingHours?: string;
  closingDays?: string;
  notes?: string;
  assignedDay?: number | null; // null = in backlog, number = Day X
  assignedMeal?: FoodCategory | null;
  timeSlot?: string;
  isVisited?: boolean;
}

export interface FlightInfo {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureCity: string;
  departureDateTime: string;
  arrivalAirport: string;
  arrivalCity: string;
  arrivalDateTime: string;
  terminal?: string;
  gate?: string;
  bookingReference?: string; // PNR
  baggageNotes?: string;
  notes?: string;
}

export interface FlightDetails {
  outboundFlight?: FlightInfo;
  returnFlight?: FlightInfo;
}

export interface AirportTransfer {
  recommendedOption: 'metro' | 'train' | 'bus' | 'taxi' | 'uber' | 'other';
  passRequired: boolean;
  passDetails?: string;       // e.g. "Abbonamento Hola BCN o T-Casual"
  specialTickets?: string;    // e.g. "Supplemento aeroporto €5.15"
  taxiVsUberAdvice?: string;  // e.g. "Taxi tariffa fissa €35 consigliato in 4 con valigie"
  estimatedCost?: string;
  estimatedDuration?: string;
  instructions?: string;
}

export interface AccommodationDetails {
  name: string;
  address: string;
  coordinates?: GeoPoint;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  bookingCode?: string;
  phoneOrContact?: string;
  notes?: string;             // e.g. "Tassa di soggiorno €4/notte, deposito bagagli gratuito"
}

export interface Trip {
  id: string;
  groupId: string;
  title: string;
  destination: string;
  country: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  coverUrl: string;
  status: TripStatus;
  decision?: TripDecision;
  proposedBy?: string; // user id, only for proposals
  votes?: string[];    // ids of members who voted in favour
  budgetEstimate?: number;
  currency: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  
  // Advanced features
  activities?: TripActivity[];
  placesToEat?: TripPlaceToEat[];
  flights?: FlightDetails;
  transfers?: AirportTransfer;
  accommodation?: AccommodationDetails;
}

export interface CreateTripDto {
  groupId: string;
  title: string;
  destination: string;
  country: string;
  startDate: string;
  endDate: string;
  coverUrl: string;
  budgetEstimate?: number;
  currency: string;
  tags: string[];
  notes?: string;
  asProposal?: boolean;
}

/** Timeline status derived from the dates, so it never gets stale. */
export function deriveTripStatus(trip: Pick<Trip, 'startDate' | 'endDate'>, now = new Date()): TripStatus {
  const today = now.toISOString().split('T')[0];
  if (trip.endDate < today) return 'completed';
  if (trip.startDate <= today) return 'ongoing';
  return 'upcoming';
}

export function isProposal(trip: Pick<Trip, 'decision'>): boolean {
  return trip.decision === 'proposal';
}

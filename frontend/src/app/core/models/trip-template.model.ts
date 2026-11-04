import { AccommodationDetails, TripActivity, TripPlaceToEat } from './trip.model';

/** A ready-made itinerary published by another user, that can be assigned to a group. */
export interface TripTemplate {
  id: string;
  title: string;
  destination: string;
  country: string;
  coverUrl: string;
  durationDays: number;
  budgetEstimate: number; // per person
  currency: string;
  tags: string[];
  description: string;
  authorName: string;
  authorColor?: string;
  rating: number; // 0-5
  reviewsCount: number;
  usesCount: number;
  /** Ids are template-local; `assignedDay` is always set. */
  activities: TripActivity[];
  /** Ids are template-local; `assignedDay` and `assignedMeal`/`timeSlot` are always set. */
  placesToEat: TripPlaceToEat[];
  accommodation?: AccommodationDetails;
  notes?: string;
}

export type ExploreSort = 'popular' | 'rating' | 'budget';
export type DurationBucket = 'all' | 'short' | 'medium' | 'long';

export interface ExploreFilters {
  text: string;
  tags: string[];
  duration: DurationBucket;
  /** 0 = no limit */
  maxBudget: number;
  sort: ExploreSort;
}

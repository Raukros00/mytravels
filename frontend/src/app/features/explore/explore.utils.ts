import { ActivityCategory, FoodCategory } from '../../core/models/trip.model';

export const ACTIVITY_ICONS: Record<ActivityCategory, string> = {
  monument: 'account_balance',
  museum: 'museum',
  nature: 'park',
  experience: 'attractions',
  shopping: 'shopping_bag',
  other: 'place'
};

export const FOOD_ICONS: Record<FoodCategory, string> = {
  breakfast: 'bakery_dining',
  lunch: 'restaurant',
  dinner: 'dinner_dining',
  snack: 'cookie',
  aperitivo: 'wine_bar'
};

export function formatBudget(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function daysLabel(days: number): string {
  return days === 1 ? '1 giorno' : `${days} giorni`;
}

export function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}

export function formatDateIt(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

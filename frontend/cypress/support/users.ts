/**
 * Utenti creati dal DataInitializer del backend (SEED_DEMO_DATA=true).
 *
 * Gruppi demo:
 *  - "Gli Esploratori ✈️"   admin (creatore), sofia, marco   → Barcellona, Lisbona
 *  - "Foodies on Tour 🍕"   marco (creatore), giulia, luca   → Napoli, Tokyo
 *  - "Weekend Warriors 🏔️"  giulia (creatore), admin, sofia, luca → Dolomiti, Amsterdam
 */
export const USERS = {
  admin: { email: 'admin@example.com', password: 'admin123', name: 'Alessandro' },
  sofia: { email: 'sofia@example.com', password: 'sofia123', name: 'Sofia' },
  marco: { email: 'marco@example.com', password: 'marco123', name: 'Marco' },
  giulia: { email: 'giulia@example.com', password: 'giulia123', name: 'Giulia' },
  luca: { email: 'luca@example.com', password: 'luca123', name: 'Luca' },
} as const;

export type DemoUser = keyof typeof USERS;

export const GROUPS = {
  esploratori: 'Gli Esploratori ✈️',
  foodies: 'Foodies on Tour 🍕',
  warriors: 'Weekend Warriors 🏔️',
} as const;

export const TRIPS = {
  barcellona: 'Barcellona Weekend & Tapas 🇪🇸',
  lisbona: 'Lisbona & Sintra 🇵🇹',
  napoli: 'Napoli & Costiera: Pizza e Mare 🍕',
  tokyo: 'Tokyo Ramen & Sushi Tour 🍜',
  dolomiti: 'Dolomiti Trekking & Rifugi 🏔️',
  amsterdam: 'Amsterdam Canali & Musei 🇳🇱',
} as const;

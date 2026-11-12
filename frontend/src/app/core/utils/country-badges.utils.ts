import { Trip, isProposal } from '../models/trip.model';
import { todayIso } from './date.utils';

/** Viaggio come serve ai badge delle nazioni. */
export type BadgeTrip = Pick<Trip, 'id' | 'title' | 'destination' | 'startDate' | 'endDate' | 'decision'> & {
  countryCode?: string | null;
};

/**
 * Badge di una nazione nel Profilo (#123).
 * - `visited`: almeno un viaggio confermato e già concluso (data di fine prima di oggi, data locale);
 * - altrimenti `upcoming`: solo viaggi confermati futuri o in corso ("in arrivo").
 */
export interface CountryBadge {
  code: string;
  state: 'visited' | 'upcoming';
  /** Viaggi conclusi nella nazione. */
  visitedCount: number;
  /** Anno della prima visita conclusa (solo `visited`). */
  firstYear: number | null;
  /** Data di inizio del prossimo viaggio non concluso, se c'è. */
  nextStart: string | null;
  /** Tutti i viaggi confermati nella nazione, dal più recente. */
  trips: BadgeTrip[];
}

const ISO2 = /^[A-Z]{2}$/;

/**
 * Badge per nazione dai viaggi confermati (le proposte non contano). I viaggi senza codice nazione
 * non danno badge. Ordine: prima le visitate (dalla prima visita più recente), poi quelle in arrivo
 * (dalla partenza più vicina).
 */
export function countryBadges(trips: readonly BadgeTrip[], now: Date = new Date()): CountryBadge[] {
  const today = todayIso(now);
  const byCode = new Map<string, BadgeTrip[]>();
  for (const t of trips) {
    const code = (t.countryCode ?? '').trim().toUpperCase();
    if (!ISO2.test(code) || isProposal(t)) continue;
    const list = byCode.get(code) ?? [];
    list.push(t);
    byCode.set(code, list);
  }
  const badges: CountryBadge[] = [];
  for (const [code, list] of byCode) {
    const done = list.filter(t => t.endDate < today);
    const notDone = list.filter(t => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
    const firstStart = done.map(t => t.startDate).sort()[0];
    badges.push({
      code,
      state: done.length ? 'visited' : 'upcoming',
      visitedCount: done.length,
      firstYear: firstStart ? Number(firstStart.slice(0, 4)) : null,
      nextStart: notDone[0]?.startDate ?? null,
      trips: [...list].sort((a, b) => b.startDate.localeCompare(a.startDate))
    });
  }
  return badges.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'visited' ? -1 : 1;
    if (a.state === 'visited') return (b.firstYear ?? 0) - (a.firstYear ?? 0) || a.code.localeCompare(b.code);
    return (a.nextStart ?? '').localeCompare(b.nextStart ?? '') || a.code.localeCompare(b.code);
  });
}

/** Bandiera emoji dal codice ISO alpha-2 (lettere "indicatore regionale"). */
export function flagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (!ISO2.test(c)) return '🏳️';
  return String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Nome della nazione nella lingua indicata (`Intl.DisplayNames`); il codice se non disponibile. */
export function countryName(code: string, lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

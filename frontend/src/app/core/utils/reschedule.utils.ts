/**
 * Spostare le tappe tra i giorni (#112): tappe da recuperare, carico e fasce libere dei giorni, giorni e orari
 * di apertura interpretabili, collocazione nella prima fascia libera compatibile e giorno consigliato.
 * Solo funzioni pure (testate in reschedule.utils.spec.ts).
 */

import { TimeRange, toMinutes } from './day-schedule.utils';
import { DEFAULT_STOP_MINUTES } from './live-day.utils';

/** Fascia della giornata in cui si cercano gli spazi liberi. */
export const DAY_START = '09:00';
export const DAY_END = '22:00';
/** Durata presunta di una tappa senza orario o senza fine, per collocarla. */
export const DEFAULT_MOVE_MINUTES = 90;
/** Sotto questa durata uno spazio non conta come "fascia libera". */
export const MIN_FREE_MINUTES = 60;

const pad = (n: number) => String(n).padStart(2, '0');

/** `HH:mm` da minuti dalla mezzanotte (limitato a 00:00–23:59). */
export function fromMinutes(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// ── Tappe da recuperare ──────────────────────────────────────────────────────

export interface RecoverCandidate {
  assignedDay?: number | null;
  done: boolean;
  skipped: boolean;
}

/**
 * Vero se la tappa è "da recuperare": saltata (in qualsiasi giorno), oppure non fatta in un giorno già passato
 * (`currentDay` = giorno del viaggio di oggi; prima della partenza vale 0, dopo la fine totalDays + 1).
 */
export function needsRecovery(stop: RecoverCandidate, currentDay: number): boolean {
  if (stop.done || stop.assignedDay == null) return false;
  return stop.skipped || stop.assignedDay < currentDay;
}

// ── Giorni e orari di apertura ───────────────────────────────────────────────

/** Nomi dei giorni (italiano e inglese, anche abbreviati) → giorno della settimana di `Date.getDay()` (0 = domenica). */
const WEEKDAY_WORDS: [string, number][] = [
  ['domenica|domeniche|dom|sunday|sundays|sun', 0],
  ['luned[iì]|lun|monday|mondays|mon', 1],
  ['marted[iì]|mar|tuesday|tuesdays|tue|tues', 2],
  ['mercoled[iì]|mer|wednesday|wednesdays|wed', 3],
  ['gioved[iì]|gio|thursday|thursdays|thu|thur|thurs', 4],
  ['venerd[iì]|ven|friday|fridays|fri', 5],
  ['sabato|sabati|sab|saturday|saturdays|sat', 6]
];
/** Parola intera anche con le lettere accentate (`\b` di JavaScript non le considera lettere). */
const WEEKDAY_RES: [RegExp, number][] = WEEKDAY_WORDS.map(([w, d]) => [new RegExp(`(?<![a-zà-ÿ])(?:${w})(?![a-zà-ÿ])`), d]);

/**
 * Giorni di chiusura scritti a mano ("Lunedì", "chiuso lun e mar", "Mondays") → giorni della settimana
 * (0 = domenica). Insieme vuoto se non si riconosce nessun giorno.
 */
export function parseClosingDays(text: string | null | undefined): Set<number> {
  const result = new Set<number>();
  if (!text) return result;
  const lower = text.toLowerCase();
  for (const [re, day] of WEEKDAY_RES) if (re.test(lower)) result.add(day);
  return result;
}

/** "9:00-19:00", "09.00 – 13.00", ma anche solo ore: "9-17" (non dentro numeri più lunghi o date). */
const HOURS_RE = /(?<![\d:.\/-])(\d{1,2})(?:[:.](\d{2}))?\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?(?![\d\/-])/g;

/**
 * Orari di apertura scritti a mano ("9:00-19:00", "09.00–13.00, 15.00–19.30", "9-17") → fasce `HH:mm`.
 * `null` se non si riconosce nessuna fascia (es. "sempre aperto"): in quel caso non si danno avvisi.
 */
export function parseOpeningHours(text: string | null | undefined): TimeRange[] | null {
  if (!text) return null;
  const ranges: TimeRange[] = [];
  for (const m of text.matchAll(HOURS_RE)) {
    const [h1, m1, h2, m2] = [m[1], m[2] ?? '0', m[3], m[4] ?? '0'].map(Number);
    if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) continue;
    const start = `${pad(h1)}:${pad(m1)}`;
    const end = h2 === 24 ? '23:59' : `${pad(h2)}:${pad(m2)}`;
    if (end > start) ranges.push({ start, end });
  }
  return ranges.length ? ranges : null;
}

// ── Carico e fasce libere ────────────────────────────────────────────────────

/** Intervallo [inizio, fine) in minuti di una tappa con orario. */
function busyInterval(times: TimeRange): [number, number] {
  const start = toMinutes(times.start);
  const end = times.end ? toMinutes(times.end) : start + DEFAULT_STOP_MINUTES;
  return [start, Math.max(end, start + 1)];
}

/** Intervalli occupati, ordinati e fusi. */
function busyIntervals(stops: readonly (TimeRange | null)[]): [number, number][] {
  const list = stops.filter((t): t is TimeRange => !!t).map(busyInterval).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of list) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

export interface DayLoad {
  /** Tappe del giorno (con e senza orario). */
  count: number;
  /** Minuti occupati dalle tappe con orario (sovrapposizioni contate una volta). */
  busyMinutes: number;
}

/** Quanto è pieno un giorno: orari effettivi delle sue tappe (`null` = senza orario). */
export function dayLoad(stops: readonly (TimeRange | null)[]): DayLoad {
  const busyMinutes = busyIntervals(stops).reduce((sum, [s, e]) => sum + (e - s), 0);
  return { count: stops.length, busyMinutes };
}

/**
 * Fasce libere della giornata tra `DAY_START` e `DAY_END` (o da `notBefore` minuti, es. "adesso" per oggi),
 * lunghe almeno `minMinutes`.
 */
export function freeSlots(stops: readonly (TimeRange | null)[], notBefore = 0, minMinutes = MIN_FREE_MINUTES): TimeRange[] {
  const dayEnd = toMinutes(DAY_END);
  let cursor = Math.max(toMinutes(DAY_START), notBefore);
  const result: TimeRange[] = [];
  for (const [s, e] of busyIntervals(stops)) {
    if (s - cursor >= minMinutes) result.push({ start: fromMinutes(cursor), end: fromMinutes(s) });
    cursor = Math.max(cursor, e);
  }
  if (dayEnd - cursor >= minMinutes) result.push({ start: fromMinutes(cursor), end: fromMinutes(dayEnd) });
  return result;
}

/** Durata (minuti) della tappa da spostare: dai suoi orari, altrimenti `DEFAULT_MOVE_MINUTES`. */
export function stopDuration(times: TimeRange | null): number {
  if (!times?.end) return DEFAULT_MOVE_MINUTES;
  return Math.max(15, toMinutes(times.end) - toMinutes(times.start));
}

/**
 * Prima collocazione compatibile: inizio più presto in una fascia libera che ci sta tutta e, se gli orari di
 * apertura sono noti, dentro una fascia di apertura. `null` se non c'è posto.
 */
export function placeInSlots(duration: number, slots: readonly TimeRange[], opening: readonly TimeRange[] | null): TimeRange | null {
  const windows = opening ?? [{ start: '00:00', end: '23:59' }];
  let best: number | null = null;
  for (const slot of slots) {
    for (const open of windows) {
      const start = Math.max(toMinutes(slot.start), toMinutes(open.start));
      const end = Math.min(toMinutes(slot.end!), toMinutes(open.end!));
      if (end - start >= duration && (best === null || start < best)) best = start;
    }
  }
  return best === null ? null : { start: fromMinutes(best), end: fromMinutes(best + duration) };
}

// ── Giorni candidati e giorno consigliato ───────────────────────────────────

export interface MoveStopInfo {
  /** Orari attuali della tappa (per la durata), `null` se non ne ha. */
  times: TimeRange | null;
  closingDays?: string | null;
  openingHours?: string | null;
  /** Ha biglietti o prenotazione: spostandola va controllata la data. */
  hasBooking: boolean;
}

export interface CandidateDay {
  day: number;
  /** Data `yyyy-MM-dd` del giorno. */
  date: string;
  /** Orari effettivi delle tappe già in quel giorno (`null` = senza orario). */
  stops: (TimeRange | null)[];
  /** Per oggi: minuti da cui si possono cercare spazi (adesso). */
  notBefore?: number;
}

export interface DayOption {
  day: number;
  date: string;
  load: DayLoad;
  free: TimeRange[];
  /** Chiuso quel giorno della settimana (giorni di chiusura). */
  closed: boolean;
  /** Orari di apertura noti ma nessuna fascia libera compatibile. */
  hoursConflict: boolean;
  /** Dove andrebbe la tappa (modificabile), `null` se non c'è posto compatibile. */
  proposed: TimeRange | null;
  /** Biglietti o prenotazione: la data va cambiata. */
  bookingWarning: boolean;
  recommended: boolean;
}

/** Giorno della settimana (0 = domenica) di una data `yyyy-MM-dd`. */
export function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Le opzioni per spostare la tappa nei giorni `days`, con il giorno consigliato: aperto, con posto compatibile,
 * il meno carico (a parità il primo). Nessun consiglio se nessun giorno va bene.
 */
export function buildDayOptions(stop: MoveStopInfo, days: readonly CandidateDay[]): DayOption[] {
  const closingDays = parseClosingDays(stop.closingDays);
  const opening = parseOpeningHours(stop.openingHours);
  const duration = stopDuration(stop.times);

  const options: DayOption[] = days.map(d => {
    const free = freeSlots(d.stops, d.notBefore ?? 0);
    const closed = closingDays.has(weekdayOf(d.date));
    const proposed = closed ? null : placeInSlots(duration, free, opening);
    return {
      day: d.day,
      date: d.date,
      load: dayLoad(d.stops),
      free,
      closed,
      hoursConflict: !closed && !!opening && !proposed && !!placeInSlots(duration, free, null),
      proposed,
      bookingWarning: stop.hasBooking,
      recommended: false
    };
  });

  const best = recommendDay(options);
  return options.map(o => (o.day === best ? { ...o, recommended: true } : o));
}

/** Il giorno consigliato tra le opzioni (vedi `buildDayOptions`), o `null`. */
export function recommendDay(options: readonly Pick<DayOption, 'day' | 'closed' | 'proposed' | 'load'>[]): number | null {
  const ok = options.filter(o => !o.closed && o.proposed);
  if (!ok.length) return null;
  return ok.reduce((best, o) =>
    o.load.busyMinutes < best.load.busyMinutes
    || (o.load.busyMinutes === best.load.busyMinutes && o.load.count < best.load.count)
      ? o : best).day;
}

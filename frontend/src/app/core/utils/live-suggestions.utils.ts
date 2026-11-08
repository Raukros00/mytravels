/**
 * Suggerimenti contestuali della guida "In viaggio" (#105): dato l'orario, le tappe di oggi con il loro stato e
 * gli orari di apertura, la guida "parla" all'utente come un accompagnatore (inizio di una tappa, pasti,
 * prenotazioni e biglietti, chiusure, ritardi, fine giornata). Solo funzioni pure: l'ora arriva da fuori.
 *
 * I testi non sono qui: ogni suggerimento ha una chiave (`live.suggest.<chiave>` in public/i18n/*.json) e i
 * parametri. Le azioni "Salta" e "Sposta a un altro giorno" usano il flusso della #112 (tappa saltata → "Da
 * recuperare", pannello "Sposta" con il giorno consigliato).
 */

import { TimeRange, toMinutes } from './day-schedule.utils';
import { LatLng, hasCoords, haversineMeters } from './geo.utils';
import { LiveStopInput, LiveStopStatus, computeLiveDay, effectiveEnds } from './live-day.utils';
import { parseClosingDays, parseOpeningHours } from './reschedule.utils';

/** Fasce dei pasti: dentro la fascia, senza un locale in programma, si propongono i locali salvati. */
export const MEAL_WINDOWS: Readonly<Record<'lunch' | 'dinner', TimeRange>> = {
  lunch: { start: '12:00', end: '14:30' },
  dinner: { start: '19:00', end: '21:30' }
};
/** Pasti per cui il locale in programma viene proposto ("È ora di pranzo: che ne dici di …"). */
export const MEALS = ['breakfast', 'lunch', 'aperitivo', 'dinner', 'snack'] as const;
export type Meal = typeof MEALS[number];

/** Il locale in programma si propone da questi minuti prima dell'inizio. */
export const MEAL_LEAD_MINUTES = 30;
/** "Chiude alle …" quando mancano al massimo questi minuti alla chiusura. */
export const CLOSING_SOON_MINUTES = 60;
/** Ritardo minimo (minuti) per proporre di spostare una tappa, e massimo oltre il quale non ha più senso. */
export const LATE_MIN_MINUTES = 30;
export const LATE_MAX_MINUTES = 180;
/** Quanti suggerimenti secondari al massimo. */
export const MAX_SECONDARY = 3;

/** Una tappa di oggi con quello che serve ai suggerimenti. */
export interface SuggestStop extends LiveStopInput {
  type: 'activity' | 'food';
  name: string;
  /** Solo ristoranti: pasto assegnato o categoria (pranzo, cena, …). */
  meal?: string | null;
  openingHours?: string | null;
  closingDays?: string | null;
  bookingRequired?: boolean;
  ticketsRequired?: boolean;
  ticketPrice?: number | null;
  currency?: string | null;
  bookingUrl?: string | null;
  coordinates?: Partial<LatLng> | null;
}

/** Un locale salvato che si può proporre per il pasto (non assegnato a un giorno, o di oggi). */
export interface SuggestPlace {
  /** Id del locale (senza prefisso). */
  id: string;
  name: string;
  address?: string | null;
  meal?: string | null;
  coordinates?: Partial<LatLng> | null;
  /** Già nella giornata di oggi (altrimenti è tra le idee non assegnate). */
  today: boolean;
}

export interface RankedPlace extends SuggestPlace {
  /** Distanza in linea d'aria (metri) dal punto di riferimento, se entrambi hanno coordinate. */
  distance: number | null;
}

export interface SuggestionInput {
  /** Minuti dalla mezzanotte dell'ora attuale. */
  nowMinutes: number;
  /** Giorno della settimana di oggi (0 = domenica, come `Date.getDay()`). */
  weekday: number;
  /** Tappe di oggi in sequenza (vedi `buildDayTimeline`). */
  stops: readonly SuggestStop[];
  /** Locali salvati non ancora visitati: non assegnati o di oggi. */
  places?: readonly SuggestPlace[];
  accommodation?: { name: string; coordinates?: Partial<LatLng> | null } | null;
  /** Suggerimenti già chiusi dall'utente ("Ignora", "Sì, l'ho fatta"), per id. */
  dismissed?: ReadonlySet<string>;
}

export type SuggestionKind =
  | 'start' | 'meal-planned' | 'meal-none' | 'booking' | 'tickets'
  | 'closing-soon' | 'closed-hours' | 'closed-today' | 'late' | 'day-end';

/**
 * Azioni dei suggerimenti:
 * - `directions` indicazioni per la tappa (o per l'alloggio a fine giornata), `go` lo stesso per il locale ("Andiamo");
 * - `done` segna fatta la tappa; `skip` la salta (#112: finisce in "Da recuperare");
 * - `move` apre il pannello "Sposta" (#112) per la tappa; `choose` mostra gli altri locali; `list` i locali salvati;
 * - `booked` ("Sì") e `ignore` chiudono il suggerimento; `link` apre il link di biglietti / prenotazione.
 */
export type SuggestionAction = 'directions' | 'go' | 'done' | 'skip' | 'move' | 'choose' | 'list' | 'booked' | 'ignore' | 'link';

export interface Suggestion {
  /** Stabile finché la situazione non cambia: serve per chiuderlo ("Ignora"). */
  id: string;
  kind: SuggestionKind;
  /** Chiave del testo sotto `live.suggest`. */
  text: string;
  params: Record<string, string | number>;
  tone: 'info' | 'warn' | 'success';
  /** Tappa a cui si riferiscono le azioni (id della guida, es. `activity:abc`); per l'alloggio non c'è. */
  stopId?: string;
  actions: SuggestionAction[];
  /** Link per `link`. */
  url?: string;
  /** Locali proposti (pasti), dal più vicino. */
  places?: RankedPlace[];
  priority: number;
}

export interface SuggestionsResult {
  primary: Suggestion | null;
  secondary: Suggestion[];
}

// ── Interpretazione di orari e chiusure ──────────────────────────────────────

const CLOSED_WORD_RE = /(chius[oaie]|closed)/i;

/**
 * Giorni di chiusura (0 = domenica): dal campo dei giorni di chiusura ("lunedì", "chiuso il lunedì") e da
 * un'eventuale indicazione negli orari ("9-17, chiuso il lunedì"). Vuoto se non si riconosce nulla.
 */
export function closedWeekdays(closingDays: string | null | undefined, openingHours?: string | null): Set<number> {
  const days = parseClosingDays(closingDays);
  const at = openingHours ? openingHours.search(CLOSED_WORD_RE) : -1;
  if (at >= 0) parseClosingDays(openingHours!.slice(at)).forEach(d => days.add(d));
  return days;
}

/** La fascia di apertura che contiene `minutes`, o `null`. */
function openRangeAt(ranges: readonly TimeRange[], minutes: number): TimeRange | null {
  return ranges.find(r => toMinutes(r.start) <= minutes && minutes < toMinutes(r.end!)) ?? null;
}

/** Il pasto di cui è "ora" (fascia di pranzo o cena), o `null`. */
export function mealWindowAt(nowMinutes: number): 'lunch' | 'dinner' | null {
  for (const meal of ['lunch', 'dinner'] as const) {
    const w = MEAL_WINDOWS[meal];
    if (nowMinutes >= toMinutes(w.start) && nowMinutes < toMinutes(w.end!)) return meal;
  }
  return null;
}

const isMeal = (value: string | null | undefined): value is Meal => !!value && (MEALS as readonly string[]).includes(value);

// ── Locali vicini ────────────────────────────────────────────────────────────

/**
 * Locali ordinati per distanza in linea d'aria da `from` (quelli senza coordinate in fondo, per nome);
 * senza punto di partenza solo per nome.
 */
export function rankPlaces(places: readonly SuggestPlace[], from: LatLng | null): RankedPlace[] {
  return places
    .map(p => ({ ...p, distance: from && hasCoords(p.coordinates) ? haversineMeters(from, p.coordinates) : null }))
    .sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return a.name.localeCompare(b.name, 'it');
    });
}

/**
 * Punto di riferimento per "vicino a te" (senza chiedere la posizione): la tappa in corso, altrimenti l'ultima
 * tappa fatta o passata con coordinate, altrimenti l'alloggio.
 */
export function referencePoint(
  stops: readonly SuggestStop[],
  statuses: ReadonlyMap<string, LiveStopStatus>,
  accommodation?: SuggestionInput['accommodation']
): LatLng | null {
  const current = stops.find(s => statuses.get(s.id) === 'current');
  if (current && hasCoords(current.coordinates)) return current.coordinates;
  const lastIndex = current ? stops.indexOf(current) - 1 : stops.length - 1;
  for (let i = lastIndex; i >= 0; i--) {
    const s = stops[i];
    const status = statuses.get(s.id);
    if ((status === 'done' || status === 'missed') && hasCoords(s.coordinates)) return s.coordinates;
  }
  return hasCoords(accommodation?.coordinates) ? accommodation!.coordinates : null;
}

// ── Motore ───────────────────────────────────────────────────────────────────

/**
 * Il suggerimento principale e quelli secondari (al massimo `MAX_SECONDARY`), dal più importante.
 * Priorità: chiusura oggi della tappa attuale > ritardo > pasto > orari della tappa attuale > fine giornata >
 * inizio della tappa > avvisi sulle tappe successive (chiusure, prenotazioni, biglietti).
 */
export function computeSuggestions(input: SuggestionInput): SuggestionsResult {
  const all = collectSuggestions(input)
    .filter(s => !input.dismissed?.has(s.id))
    .sort((a, b) => b.priority - a.priority);
  return { primary: all[0] ?? null, secondary: all.slice(1, 1 + MAX_SECONDARY) };
}

/** Tutti i suggerimenti validi adesso (non ordinati, compresi quelli chiusi dall'utente). */
export function collectSuggestions(input: SuggestionInput): Suggestion[] {
  const { nowMinutes, stops } = input;
  const live = computeLiveDay(stops, nowMinutes);
  const status = (s: SuggestStop) => live.statuses.get(s.id) ?? 'todo';
  const pending = stops.filter(s => ['current', 'next', 'todo'].includes(status(s)));
  const focus = live.focus;
  const result: Suggestion[] = [];

  // Chiusure: giorno di chiusura, orari di apertura incompatibili, chiusura imminente.
  for (const stop of pending) {
    const isFocus = stop === focus;
    const closedDays = closedWeekdays(stop.closingDays, stop.openingHours);
    if (closedDays.has(input.weekday)) {
      result.push({
        id: `closed-today:${stop.id}`, kind: 'closed-today', text: 'closed_today',
        params: { name: stop.name, weekday: input.weekday }, tone: 'warn', stopId: stop.id,
        actions: ['move', 'skip'], priority: isFocus ? 100 : 40
      });
      continue;
    }
    const opening = parseOpeningHours(stop.openingHours);
    if (!opening) continue;
    const plannedStart = stop.times ? toMinutes(stop.times.start) : null;
    // Si controlla l'orario in cui si sarà lì: adesso se la tappa è in corso o senza orario, altrimenti l'inizio.
    const at = plannedStart === null || plannedStart < nowMinutes ? nowMinutes : plannedStart;
    const range = openRangeAt(opening, at);
    if (!range) {
      // Chiuso all'orario previsto (e non solo perché la giornata è finita da un pezzo).
      result.push({
        id: `closed-hours:${stop.id}`, kind: 'closed-hours', text: 'closed_hours',
        params: { name: stop.name, hours: opening.map(r => `${r.start}–${r.end}`).join(', ') }, tone: 'warn',
        stopId: stop.id, actions: ['move', 'ignore'], priority: isFocus ? 70 : 35
      });
      continue;
    }
    const closing = toMinutes(range.end!);
    const plannedEnd = stop.times?.end ? toMinutes(stop.times.end) : null;
    const leftNow = closing - nowMinutes;
    const isHere = status(stop) === 'current';
    if (isHere && leftNow <= CLOSING_SOON_MINUTES) {
      result.push({
        id: `closing-soon:${stop.id}`, kind: 'closing-soon', text: 'closing_soon',
        params: { name: stop.name, time: range.end!, minutes: leftNow }, tone: 'warn', stopId: stop.id,
        actions: ['ignore'], priority: isFocus ? 65 : 35
      });
    } else if (plannedEnd !== null && plannedEnd > closing) {
      result.push({
        id: `closes-early:${stop.id}`, kind: 'closing-soon', text: 'closes_before_end',
        params: { name: stop.name, time: range.end! }, tone: 'warn', stopId: stop.id,
        actions: ['move', 'ignore'], priority: isFocus ? 65 : 35
      });
    }
  }

  // Ritardo: la tappa prima di quella attuale è passata da poco senza essere segnata.
  const late = lateSuggestion(input, live.statuses, focus);
  if (late) result.push(late);

  // Pasti.
  const meal = mealSuggestion(input, live.statuses, pending);
  if (meal) result.push(meal);

  // Fine giornata (con tappe in programma: la giornata vuota ha già il suo messaggio).
  if (live.phase === 'finished') {
    const home = input.accommodation?.name ? input.accommodation : null;
    result.push({
      id: 'day-end', kind: 'day-end', text: home ? 'day_end_home' : 'day_end',
      params: home ? { name: home.name } : {}, tone: 'success',
      actions: home ? ['directions'] : [], priority: 60
    });
  }

  // Inizio di una tappa (non i pasti, che hanno il loro suggerimento, né una tappa chiusa oggi).
  const focusClosed = result.some(s => s.kind === 'closed-today' && s.stopId === focus?.id);
  if (focus && live.focusKind === 'current' && !focusClosed && !(focus.type === 'food' && isMeal(focus.meal))) {
    const next = live.upNext[0];
    result.push({
      id: `start:${focus.id}`, kind: 'start', text: next ? 'start' : 'start_last',
      params: next ? { name: focus.name, next: next.name } : { name: focus.name }, tone: 'info',
      stopId: focus.id, actions: ['directions', 'done'], priority: 50
    });
  }

  // Prenotazioni e biglietti delle tappe ancora da fare.
  for (const stop of pending) {
    const isFocus = stop === focus;
    if (stop.ticketsRequired) {
      const price = stop.ticketPrice && stop.ticketPrice > 0 ? stop.ticketPrice : null;
      result.push({
        id: `tickets:${stop.id}`, kind: 'tickets', text: price ? 'tickets_price' : 'tickets',
        params: price ? { name: stop.name, price, currency: stop.currency || 'EUR' } : { name: stop.name },
        tone: 'info', stopId: stop.id, url: stop.bookingUrl || undefined,
        actions: stop.bookingUrl ? ['link', 'ignore'] : ['ignore'], priority: isFocus ? 32 : 25
      });
    } else if (stop.bookingRequired) {
      result.push({
        id: `booking:${stop.id}`, kind: 'booking', text: stop.type === 'food' ? 'booking_food' : 'booking',
        params: { name: stop.name }, tone: 'info', stopId: stop.id, url: stop.bookingUrl || undefined,
        actions: stop.bookingUrl ? ['booked', 'link'] : ['booked'], priority: isFocus ? 33 : 30
      });
    }
  }

  return result;
}

function lateSuggestion(input: SuggestionInput, statuses: ReadonlyMap<string, LiveStopStatus>, focus: SuggestStop | null): Suggestion | null {
  const { stops, nowMinutes } = input;
  if (!focus) return null;
  const focusIndex = stops.indexOf(focus);
  const ends = effectiveEnds(stops);
  // La tappa precedente da fare (le saltate non contano).
  let prev = -1;
  for (let i = focusIndex - 1; i >= 0; i--) {
    if (statuses.get(stops[i].id) !== 'skipped') {
      prev = i;
      break;
    }
  }
  if (prev < 0 || statuses.get(stops[prev].id) !== 'missed' || ends[prev] === null) return null;
  const delay = nowMinutes - ends[prev]!;
  if (delay < LATE_MIN_MINUTES || delay > LATE_MAX_MINUTES) return null;
  // Si propone di spostare l'ultima attività ancora da fare (i pasti si saltano, non si spostano).
  const candidates = stops.filter((s, i) => i >= focusIndex && s.type === 'activity'
    && ['current', 'next', 'todo'].includes(statuses.get(s.id) ?? ''));
  const toMove = candidates[candidates.length - 1];
  if (!toMove) return null;
  return {
    id: `late:${stops[prev].id}`, kind: 'late', text: 'late',
    params: { minutes: Math.round(delay / 5) * 5 || delay, name: toMove.name, previous: stops[prev].name },
    tone: 'warn', stopId: toMove.id, actions: ['move', 'ignore'], priority: 90
  };
}

function mealSuggestion(input: SuggestionInput, statuses: ReadonlyMap<string, LiveStopStatus>, pending: readonly SuggestStop[]): Suggestion | null {
  const { nowMinutes, stops } = input;
  const from = referencePoint(stops, statuses, input.accommodation);
  const places = (input.places ?? []);

  // Locale in programma: dalla mezz'ora prima fino alla fine del pasto.
  const planned = pending.find(s => {
    if (s.type !== 'food' || !isMeal(s.meal) || !s.times) return false;
    const start = toMinutes(s.times.start);
    const end = s.times.end ? toMinutes(s.times.end) : start + 90;
    return nowMinutes >= start - MEAL_LEAD_MINUTES && nowMinutes < end;
  });
  if (planned) {
    const others = rankPlaces(places.filter(p => `food:${p.id}` !== planned.id), from);
    return {
      id: `meal-planned:${planned.id}`, kind: 'meal-planned', text: 'meal_planned',
      params: { name: planned.name, meal: planned.meal! }, tone: 'info', stopId: planned.id,
      actions: others.length ? ['go', 'choose', 'skip'] : ['go', 'skip'], places: others, priority: 80
    };
  }

  // Fascia del pasto senza locale: i locali salvati (non assegnati o di oggi), dal più vicino.
  const meal = mealWindowAt(nowMinutes);
  if (!meal) return null;
  const window = MEAL_WINDOWS[meal];
  const covered = stops.some(s => {
    if (s.type !== 'food') return false;
    if (s.meal === meal) return true;
    if (!s.times) return false;
    const start = toMinutes(s.times.start);
    const end = s.times.end ? toMinutes(s.times.end) : start + 60;
    return start < toMinutes(window.end!) && toMinutes(window.start) < end;
  });
  if (covered) return null;
  const ranked = rankPlaces(places, from);
  const near = !!from && ranked.some(p => p.distance !== null);
  return {
    id: `meal-none:${meal}`, kind: 'meal-none',
    text: ranked.length === 0 ? 'meal_none_empty' : near ? 'meal_none_near' : 'meal_none',
    params: { meal, count: ranked.length }, tone: 'info',
    actions: ranked.length ? ['list', 'ignore'] : ['ignore'], places: ranked, priority: 75
  };
}

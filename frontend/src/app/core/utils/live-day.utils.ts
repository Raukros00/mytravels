/**
 * Modalità "In viaggio" (#103): quale giorno del viaggio è oggi e, dentro la giornata, cosa fare adesso,
 * cosa viene dopo e lo stato di ogni tappa. Solo funzioni pure (niente `new Date()` qui dentro): l'ora
 * attuale arriva sempre da fuori, così si possono provare con un orario qualsiasi e riusare nella #105
 * (suggerimenti) e nella #112 (tappe da recuperare).
 *
 * Regole della giornata:
 * - le tappe arrivano già in sequenza (vedi `sortDayStops` / `buildDayTimeline`);
 * - una tappa "fatta" o "saltata" esce dal flusso;
 * - una tappa con orario è "scaduta" quando la sua fine è passata: fine impostata, altrimenti l'inizio della
 *   tappa con orario successiva, altrimenti un'ora dopo l'inizio (`DEFAULT_STOP_MINUTES`);
 * - "Adesso" è la prima tappa da fare non scaduta: in corso se è già iniziata, la prossima se inizia più tardi;
 * - una tappa senza orario non scade mai e si fa quando arriva il suo turno nella sequenza.
 */

import { addDaysIso } from './date.utils';
import { TimeRange, toMinutes } from './day-schedule.utils';

/** Durata presunta di una tappa che ha solo l'orario di inizio (e nessuna tappa con orario dopo). */
export const DEFAULT_STOP_MINUTES = 60;

/** Il minimo che serve alla guida: id, nome, orari effettivi e stato. */
export interface LiveStopInput {
  id: string;
  /** Orari effettivi (impostati, dalla fascia scritta a mano o indicativi del pasto); `null` = senza orario. */
  times: TimeRange | null;
  done: boolean;
  skipped: boolean;
}

/**
 * Stato di una tappa nella linea del tempo della giornata:
 * - `done` fatta, `skipped` saltata;
 * - `current` in corso adesso, `next` la prossima (si è tra due tappe o prima della prima);
 * - `todo` da fare più tardi;
 * - `missed` da fare ma il suo orario è passato senza che sia stata segnata (la #112 la propone da recuperare).
 */
export type LiveStopStatus = 'done' | 'skipped' | 'current' | 'next' | 'todo' | 'missed';

/**
 * Fase della giornata:
 * - `empty` nessuna tappa in programma;
 * - `before` nessuna tappa ancora iniziata né segnata, la prima inizia più tardi;
 * - `during` c'è una tappa da fare adesso o dopo;
 * - `finished` niente più da fare (tappe fatte, saltate o con l'orario passato).
 */
export type LiveDayPhase = 'empty' | 'before' | 'during' | 'finished';

export interface LiveDayState<T extends LiveStopInput = LiveStopInput> {
  phase: LiveDayPhase;
  /** La tappa di "Adesso" (in corso o prossima), `null` se la giornata è vuota o finita. */
  focus: T | null;
  /** `current` se la tappa di "Adesso" è già iniziata (o è senza orario), `next` se inizia più tardi. */
  focusKind: 'current' | 'next' | null;
  /** Minuti all'inizio della tappa di "Adesso" se non è ancora iniziata. */
  minutesToFocus: number | null;
  /** Le tappe successive da fare (al massimo `upNextCount`). */
  upNext: T[];
  /** Stato di ogni tappa, per id. */
  statuses: Map<string, LiveStopStatus>;
  /** Tappe rimaste da fare (né fatte né saltate), comprese quelle con l'orario passato. */
  remaining: T[];
  doneCount: number;
  skippedCount: number;
}

/** Minuti dalla mezzanotte dell'ora locale di `now`. */
export function minutesOfDay(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Fine "effettiva" di ogni tappa con orario (minuti), per indice: la fine impostata, altrimenti l'inizio della
 * prossima tappa con orario che inizia dopo, altrimenti inizio + `DEFAULT_STOP_MINUTES`. `null` per le tappe senza orario.
 */
export function effectiveEnds(stops: readonly LiveStopInput[]): (number | null)[] {
  return stops.map((stop, i) => {
    if (!stop.times) return null;
    const start = toMinutes(stop.times.start);
    if (stop.times.end) return toMinutes(stop.times.end);
    const nextStart = stops.slice(i + 1)
      .map(s => (s.times ? toMinutes(s.times.start) : NaN))
      .find(m => !Number.isNaN(m) && m > start);
    return nextStart ?? start + DEFAULT_STOP_MINUTES;
  });
}

/** Adesso / dopo / stato delle tappe della giornata all'ora `nowMinutes` (minuti dalla mezzanotte). */
export function computeLiveDay<T extends LiveStopInput>(stops: readonly T[], nowMinutes: number, upNextCount = 2): LiveDayState<T> {
  const statuses = new Map<string, LiveStopStatus>();
  const ends = effectiveEnds(stops);
  const remaining = stops.filter(s => !s.done && !s.skipped);
  const doneCount = stops.filter(s => s.done).length;
  const skippedCount = stops.filter(s => !s.done && s.skipped).length;

  if (stops.length === 0) {
    return { phase: 'empty', focus: null, focusKind: null, minutesToFocus: null, upNext: [], statuses, remaining, doneCount, skippedCount };
  }

  const isExpired = (i: number) => ends[i] !== null && ends[i]! <= nowMinutes;
  let focusIndex = -1;
  stops.forEach((stop, i) => {
    if (stop.done) statuses.set(stop.id, 'done');
    else if (stop.skipped) statuses.set(stop.id, 'skipped');
    else if (focusIndex < 0 && !isExpired(i)) focusIndex = i;
  });

  let focusKind: 'current' | 'next' | null = null;
  let minutesToFocus: number | null = null;
  if (focusIndex >= 0) {
    const times = stops[focusIndex].times;
    const start = times ? toMinutes(times.start) : null;
    focusKind = start !== null && start > nowMinutes ? 'next' : 'current';
    minutesToFocus = focusKind === 'next' ? start! - nowMinutes : null;
  }

  const upNext: T[] = [];
  stops.forEach((stop, i) => {
    if (statuses.has(stop.id)) return;
    if (i === focusIndex) statuses.set(stop.id, focusKind!);
    else if (focusIndex < 0 || i < focusIndex) statuses.set(stop.id, isExpired(i) ? 'missed' : 'todo');
    else {
      statuses.set(stop.id, 'todo');
      if (upNext.length < upNextCount) upNext.push(stop);
    }
  });

  let phase: LiveDayPhase;
  if (focusIndex < 0) phase = 'finished';
  else if (focusKind === 'next' && doneCount === 0 && skippedCount === 0 && [...statuses.values()].every(s => s !== 'missed')) phase = 'before';
  else phase = 'during';

  return {
    phase,
    focus: focusIndex >= 0 ? stops[focusIndex] : null,
    focusKind,
    minutesToFocus,
    upNext,
    statuses,
    remaining,
    doneCount,
    skippedCount
  };
}

/** Giorni tra due date `yyyy-MM-dd` (to − from), senza effetti di fuso e ora legale. */
export function daysBetweenIso(from: string, to: string): number {
  const utc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export interface TripDayInfo {
  /** Prima dell'inizio, durante, o dopo la fine del viaggio. */
  state: 'before' | 'during' | 'after';
  /** Giorno del viaggio di oggi (1 = primo giorno); fuori dal viaggio è fuori da 1…totalDays. */
  dayNumber: number;
  totalDays: number;
  /** Giorni che mancano alla partenza (solo `before`). */
  daysToStart: number;
  isLastDay: boolean;
}

/** Quale giorno del viaggio è `today` (data locale `yyyy-MM-dd`, vedi `todayIso`). */
export function tripDayInfo(startDate: string, endDate: string, today: string): TripDayInfo {
  const totalDays = Math.max(1, daysBetweenIso(startDate, endDate) + 1);
  const dayNumber = daysBetweenIso(startDate, today) + 1;
  const state = dayNumber < 1 ? 'before' : dayNumber > totalDays ? 'after' : 'during';
  return {
    state,
    dayNumber,
    totalDays,
    daysToStart: state === 'before' ? 1 - dayNumber : 0,
    isLastDay: state === 'during' && dayNumber === totalDays
  };
}

/** Data `yyyy-MM-dd` del giorno `day` del viaggio (1 = `startDate`). */
export function tripDayDate(startDate: string, day: number): string {
  return addDaysIso(startDate, day - 1);
}

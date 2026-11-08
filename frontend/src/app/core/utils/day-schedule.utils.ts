/**
 * Orari e ordine delle tappe di una giornata (attività e ristoranti). Solo funzioni pure: servono
 * all'itinerario (#101) e alla modalità "In viaggio" (adesso / dopo, suggerimenti dei pasti).
 *
 * Regole:
 * - orari `HH:mm` (`startTime`, `endTime` facoltativi; la fine solo dopo l'inizio);
 * - senza orari si usa la fascia scritta a mano se riconoscibile (`timeSlot`, es. "10:00 - 12:30");
 * - pranzo e cena senza orario hanno un orario indicativo (12:30–14:00, 20:00–21:30), mai salvato;
 * - l'ordine scelto dall'utente (`dayOrder`) prevale; le tappe senza ordine si inseriscono in base all'orario.
 */

export type StopType = 'activity' | 'food';

/** Il minimo che serve per ordinare una tappa: attività e ristoranti lo soddisfano entrambi. */
export interface ScheduleStop {
  id: string;
  name: string;
  startTime?: string | null;
  endTime?: string | null;
  timeSlot?: string | null;
  dayOrder?: number | null;
  /** Solo ristoranti: pasto a cui sono assegnati ('lunch', 'dinner', ...). */
  assignedMeal?: string | null;
}

export interface TimeRange {
  start: string;
  end: string | null;
}

/** Da dove viene l'orario: impostato, ricavato dal testo libero, o indicativo del pasto. */
export type TimeSource = 'set' | 'slot' | 'meal-default';

export interface StopTimes extends TimeRange {
  source: TimeSource;
}

/** Orari indicativi dei pasti senza orario (configurabili più avanti). */
export const MEAL_DEFAULT_TIMES: Readonly<Record<string, TimeRange>> = {
  lunch: { start: '12:30', end: '14:00' },
  dinner: { start: '20:00', end: '21:30' }
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOT_RE = /^\s*(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?\s*$/;

/** `HH:mm` valido (00:00–23:59, due cifre). */
export function isValidTime(value: string | null | undefined): value is string {
  return !!value && TIME_RE.test(value);
}

/** Minuti dalla mezzanotte di un orario `HH:mm` (NaN se non valido). */
export function toMinutes(time: string): number {
  if (!isValidTime(time)) return NaN;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function normTime(h: string, m: string): string | null {
  const hours = Number(h);
  const minutes = Number(m);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${m}`;
}

/**
 * Interpreta una fascia scritta a mano: "10:00 - 12:30", "10.00-12.30", "9:30" (anche con – o —).
 * Una fine non successiva all'inizio viene scartata. `null` se non riconoscibile (es. "mattina").
 * Stesse regole della migrazione V9 e di TimeSlots.parse nel backend.
 */
export function parseTimeSlot(slot: string | null | undefined): TimeRange | null {
  const m = slot ? SLOT_RE.exec(slot) : null;
  if (!m) return null;
  const start = normTime(m[1], m[2]);
  if (!start) return null;
  let end: string | null = null;
  if (m[3] !== undefined) {
    end = normTime(m[3], m[4]);
    if (!end) return null;
    if (end <= start) end = null;
  }
  return { start, end };
}

/** "10:00–12:30" oppure "10:00". */
export function formatTimeRange(start: string, end?: string | null): string {
  return end ? `${start}–${end}` : start;
}

/**
 * Problema negli orari inseriti, o `null` se vanno bene (entrambi facoltativi).
 */
export function validateTimeRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const s = start || null;
  const e = end || null;
  if (s && !isValidTime(s)) return 'Orario di inizio non valido.';
  if (e && !isValidTime(e)) return 'Orario di fine non valido.';
  if (e && !s) return 'Indica anche l\'orario di inizio.';
  if (s && e && e <= s) return 'La fine deve essere dopo l\'inizio.';
  return null;
}

/** Orari con cui la tappa va considerata nella giornata, o `null` se non ne ha. */
export function effectiveTimes(stop: ScheduleStop): StopTimes | null {
  if (isValidTime(stop.startTime)) {
    const end = isValidTime(stop.endTime) && stop.endTime > stop.startTime ? stop.endTime : null;
    return { start: stop.startTime, end, source: 'set' };
  }
  const parsed = parseTimeSlot(stop.timeSlot);
  if (parsed) return { ...parsed, source: 'slot' };
  const meal = stop.assignedMeal ? MEAL_DEFAULT_TIMES[stop.assignedMeal] : undefined;
  if (meal) return { ...meal, source: 'meal-default' };
  return null;
}

function byTimeThenName(a: ScheduleStop, b: ScheduleStop): number {
  const ta = effectiveTimes(a);
  const tb = effectiveTimes(b);
  if (ta && tb && ta.start !== tb.start) return ta.start < tb.start ? -1 : 1;
  if (ta && !tb) return -1;
  if (!ta && tb) return 1;
  return a.name.localeCompare(b.name, 'it');
}

/**
 * Sequenza della giornata: prima le tappe con un ordine scelto (`dayOrder`), poi ciascuna delle altre
 * inserita prima della prima tappa che inizia più tardi; quelle senza orario né ordine in fondo.
 * Non modifica l'array ricevuto.
 */
export function sortDayStops<T extends ScheduleStop>(stops: readonly T[]): T[] {
  const hasOrder = (s: T) => s.dayOrder !== null && s.dayOrder !== undefined;
  const result = stops.filter(hasOrder).sort((a, b) => (a.dayOrder! - b.dayOrder!) || byTimeThenName(a, b));
  const rest = stops.filter(s => !hasOrder(s)).sort(byTimeThenName);

  for (const stop of rest) {
    const times = effectiveTimes(stop);
    if (!times) {
      result.push(stop);
      continue;
    }
    const at = result.findIndex(other => {
      const t = effectiveTimes(other);
      return !!t && t.start > times.start;
    });
    if (at < 0) result.push(stop);
    else result.splice(at, 0, stop);
  }
  return result;
}

/** Vero se gli orari delle due tappe si accavallano (una tappa senza fine vale come un istante). */
export function timesOverlap(a: TimeRange, b: TimeRange): boolean {
  if (a.start === b.start) return true;
  const aEnd = a.end ?? a.start;
  const bEnd = b.end ?? b.start;
  return a.start < bEnd && b.start < aEnd;
}

/** Per ogni tappa, le altre tappe della giornata con cui si sovrappone (solo quelle con sovrapposizioni). */
export function findOverlaps<T extends ScheduleStop>(stops: readonly T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  const timed = stops.map(s => ({ stop: s, times: effectiveTimes(s) })).filter(x => x.times !== null);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      if (!timesOverlap(timed[i].times!, timed[j].times!)) continue;
      const a = timed[i].stop;
      const b = timed[j].stop;
      result.set(a.id, [...(result.get(a.id) ?? []), b]);
      result.set(b.id, [...(result.get(b.id) ?? []), a]);
    }
  }
  return result;
}

/** Sposta l'elemento `from` in posizione `to` (limitata agli estremi). Restituisce un nuovo array. */
export function moveStop<T>(list: readonly T[], from: number, to: number): T[] {
  const result = [...list];
  if (from < 0 || from >= result.length) return result;
  const target = Math.max(0, Math.min(to, result.length - 1));
  const [item] = result.splice(from, 1);
  result.splice(target, 0, item);
  return result;
}

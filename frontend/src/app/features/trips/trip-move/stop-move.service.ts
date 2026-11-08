import { Injectable, inject, signal } from '@angular/core';
import { TripService } from '../../../core/services/trip.service';
import { Trip, TripActivity, TripPlaceToEat } from '../../../core/models/trip.model';
import { TimeRange, formatTimeRange } from '../../../core/utils/day-schedule.utils';
import { needsRecovery } from '../../../core/utils/reschedule.utils';

/** Una tappa del viaggio: attività o ristorante. */
export interface StopRef {
  type: 'activity' | 'food';
  id: string;
}

/** I campi che uno spostamento cambia (e che "Annulla" ripristina). */
interface MoveFields {
  assignedDay: number | null;
  startTime: string | null;
  endTime: string | null;
  timeSlot: string;
  dayOrder: number | null;
  isSkipped: boolean;
}

export interface LastMove {
  tripId: string;
  ref: StopRef;
  message: string;
  previous: MoveFields;
}

/** Quanto resta visibile "Annulla" dopo uno spostamento. */
const UNDO_MS = 10_000;

/** Una tappa del viaggio con il suo tipo, per le liste "Da recuperare". */
export interface TripStop extends StopRef {
  name: string;
  assignedDay: number | null;
  done: boolean;
  skipped: boolean;
  raw: TripActivity | TripPlaceToEat;
}

/** Tutte le tappe del viaggio (attività e ristoranti) in una lista. */
export function tripStops(trip: Trip): TripStop[] {
  return [
    ...(trip.activities ?? []).map(a => ({
      type: 'activity' as const, id: a.id, name: a.name, assignedDay: a.assignedDay ?? null,
      done: !!a.isCompleted, skipped: !a.isCompleted && !!a.isSkipped, raw: a
    })),
    ...(trip.placesToEat ?? []).map(p => ({
      type: 'food' as const, id: p.id, name: p.name, assignedDay: p.assignedDay ?? null,
      done: !!p.isVisited, skipped: !p.isVisited && !!p.isSkipped, raw: p
    }))
  ];
}

/** Tappe "da recuperare" (#112) con `currentDay` = giorno del viaggio di oggi, ordinate per giorno. */
export function recoverStops(trip: Trip, currentDay: number): TripStop[] {
  return tripStops(trip)
    .filter(s => needsRecovery(s, currentDay))
    .sort((a, b) => (a.assignedDay ?? 0) - (b.assignedDay ?? 0) || a.name.localeCompare(b.name, 'it'));
}

/**
 * Spostamento delle tappe tra i giorni (#112): salva con l'endpoint della singola tappa (il gruppo lo vede al
 * prossimo caricamento) e tiene l'ultimo spostamento per "Annulla".
 */
@Injectable({ providedIn: 'root' })
export class StopMoveService {
  private readonly tripService = inject(TripService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly lastMove = signal<LastMove | null>(null);

  /**
   * Sposta la tappa nel giorno `day` (null = tra le idee non assegnate) con gli orari `times`: torna "da fare"
   * (non più saltata) e si colloca nella giornata in base all'orario.
   */
  move(tripId: string, ref: StopRef, day: number | null, times: TimeRange | null): void {
    const item = this.find(tripId, ref);
    if (!item) return;
    const previous: MoveFields = {
      assignedDay: item.assignedDay ?? null,
      startTime: item.startTime ?? null,
      endTime: item.endTime ?? null,
      timeSlot: item.timeSlot ?? '',
      dayOrder: item.dayOrder ?? null,
      isSkipped: !!item.isSkipped
    };
    const next: MoveFields = {
      assignedDay: day,
      startTime: day !== null ? times?.start ?? null : null,
      endTime: day !== null ? times?.end ?? null : null,
      timeSlot: day !== null && times ? formatTimeRange(times.start, times.end) : '',
      dayOrder: null,
      isSkipped: false
    };
    const message = day !== null
      ? `"${item.name}" spostato al giorno ${day}${times ? ` alle ${times.start}` : ''}.`
      : `"${item.name}" rimesso tra le idee da pianificare.`;
    // Conferma e "Annulla" nella barra in basso (MoveUndoBarComponent), senza un toast in più.
    this.save(tripId, ref, next, '');
    this.lastMove.set({ tripId, ref, message, previous });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.lastMove.set(null), UNDO_MS);
  }

  /** Annulla l'ultimo spostamento. */
  undo(): void {
    const last = this.lastMove();
    if (!last) return;
    this.lastMove.set(null);
    const item = this.find(last.tripId, last.ref);
    this.save(last.tripId, last.ref, last.previous, `Spostamento di "${item?.name ?? 'tappa'}" annullato.`);
  }

  dismiss(): void {
    this.lastMove.set(null);
  }

  private find(tripId: string, ref: StopRef): TripActivity | TripPlaceToEat | undefined {
    const trip = this.tripService.getTripById(tripId);
    const list: (TripActivity | TripPlaceToEat)[] = ref.type === 'activity' ? trip?.activities ?? [] : trip?.placesToEat ?? [];
    return list.find(i => i.id === ref.id);
  }

  private save(tripId: string, ref: StopRef, fields: MoveFields, message: string): void {
    if (ref.type === 'activity') this.tripService.updateActivity(tripId, ref.id, fields, message);
    else this.tripService.updatePlaceToEat(tripId, ref.id, fields, message);
  }
}

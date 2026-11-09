import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, timeout } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { ClockService } from './clock.service';
import { StorageService } from './storage.service';
import { Trip, isProposal } from '../models/trip.model';
import { addDaysIso, todayIso } from '../utils/date.utils';

/** Il minimo di un viaggio per la homepage durante il viaggio (#104). */
export interface LiveTripSummary {
  id: string;
  groupId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  confirmed: boolean;
  /** Tappe assegnate a un giorno e quante sono state fatte. */
  stopsTotal: number;
  stopsDone: number;
  /** Spese vere (senza i pagamenti tra membri), nella valuta del viaggio. */
  expensesTotal: number;
  currency: string;
}

const LAST_USED_KEY = 'wb_live_last_trip';
const RECAPS_SEEN_KEY = 'wb_trip_recaps_seen';
/** Il riepilogo "Com'è andato il viaggio" si propone nei giorni dopo la fine. */
const RECAP_DAYS = 14;
/** All'apertura dell'app non si aspetta il server più di così: poi si va alla home di sempre. */
const HOME_TIMEOUT_MS = 4000;

/**
 * Viaggi in corso oggi (data locale, vedi ClockService) nei gruppi dell'utente: la homepage diventa la guida
 * della giornata (#104), la barra in basso mostra "Oggi" e, finito il viaggio, la lista dei viaggi propone
 * il riepilogo. Usa GET /api/v1/trips (viaggi di tutti i gruppi dell'utente).
 */
@Injectable({ providedIn: 'root' })
export class LiveTripService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(ClockService);
  private readonly storage = inject(StorageService);

  private readonly tripsSignal = signal<LiveTripSummary[]>([]);
  private readonly lastUsed = signal<string | null>(this.storage.getItem<string>(LAST_USED_KEY));
  private readonly recapsSeen = signal<string[]>(this.storage.getItem<string[]>(RECAPS_SEEN_KEY) ?? []);
  private inflight: Observable<LiveTripSummary[]> | null = null;

  private readonly today = computed(() => todayIso(this.clock.now()));

  /** Viaggi confermati in corso oggi; per primo l'ultimo aperto in modalità "In viaggio", poi il più recente. */
  readonly ongoingTrips = computed(() => {
    const today = this.today();
    const last = this.lastUsed();
    return this.tripsSignal()
      .filter(t => t.confirmed && t.startDate <= today && today <= t.endDate)
      .sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : b.startDate.localeCompare(a.startDate)));
  });

  /** Il viaggio da aprire: l'ultimo usato tra quelli in corso, altrimenti quello iniziato più di recente. */
  readonly preferredTrip = computed(() => this.ongoingTrips()[0] ?? null);

  /** Viaggi finiti da poco di cui non si è ancora visto il riepilogo. */
  readonly pendingRecaps = computed(() => {
    const today = this.today();
    const from = addDaysIso(today, -RECAP_DAYS);
    const seen = new Set(this.recapsSeen());
    return this.tripsSignal()
      .filter(t => t.confirmed && t.endDate < today && t.endDate >= from && !seen.has(t.id))
      .sort((a, b) => b.endDate.localeCompare(a.endDate));
  });

  constructor() {
    // All'accesso (e all'apertura dell'app da loggati) si caricano i viaggi; al logout si dimenticano.
    effect(() => {
      if (this.auth.currentUser()) this.refresh().subscribe();
      else this.tripsSignal.set([]);
    });
  }

  /** Ricarica i viaggi dell'utente (una sola richiesta alla volta). */
  refresh(): Observable<LiveTripSummary[]> {
    if (!this.inflight) {
      this.inflight = this.api.get<Trip[]>('/api/v1/trips').pipe(
        map(trips => (trips ?? []).map(toSummary)),
        tap(list => {
          if (this.auth.currentUser()) this.tripsSignal.set(list);
        }),
        catchError(err => {
          console.warn('Could not load trips for the live mode:', err?.status);
          // Offline (#109): si usano i viaggi salvati sul dispositivo, così la guida si apre lo stesso.
          if (!this.tripsSignal().length && this.auth.currentUser()) {
            this.tripsSignal.set(this.storage.getTrips().map(toSummary));
          }
          return of(this.tripsSignal());
        }),
        finalize(() => (this.inflight = null)),
        shareReplay(1)
      );
    }
    return this.inflight;
  }

  /**
   * Pagina iniziale all'apertura dell'app o dopo l'accesso: la guida del viaggio in corso, se c'è,
   * altrimenti `fallback`. Se il server non risponde in tempo si va al `fallback`.
   */
  homeUrl(fallback = '/trips'): Observable<string> {
    return this.refresh().pipe(
      timeout(HOME_TIMEOUT_MS),
      catchError(() => of([])),
      map(() => {
        const trip = this.preferredTrip();
        return trip ? `/trips/${trip.id}/live` : fallback;
      })
    );
  }

  /** Ricorda il viaggio aperto in modalità "In viaggio": con più viaggi in corso si riapre questo. */
  markUsed(tripId: string): void {
    if (this.lastUsed() === tripId) return;
    this.lastUsed.set(tripId);
    this.storage.setItem(LAST_USED_KEY, tripId);
  }

  /** Il riepilogo del viaggio non va più proposto. */
  dismissRecap(tripId: string): void {
    const seen = [...new Set([...this.recapsSeen(), tripId])].slice(-50);
    this.recapsSeen.set(seen);
    this.storage.setItem(RECAPS_SEEN_KEY, seen);
  }
}

function toSummary(trip: Trip): LiveTripSummary {
  const stops = [
    ...(trip.activities ?? []).filter(a => a.assignedDay != null).map(a => !!a.isCompleted),
    ...(trip.placesToEat ?? []).filter(p => p.assignedDay != null).map(p => !!p.isVisited)
  ];
  const expensesTotal = (trip.expenses ?? [])
    .filter(e => e.type !== 'settlement')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  return {
    id: trip.id,
    groupId: trip.groupId,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    confirmed: !isProposal(trip),
    stopsTotal: stops.length,
    stopsDone: stops.filter(Boolean).length,
    expensesTotal: Math.round(expensesTotal * 100) / 100,
    currency: trip.currency || 'EUR'
  };
}

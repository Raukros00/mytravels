import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, forkJoin, from, of, switchMap, tap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { USE_MOCK_DATA } from '../config/mock.config';
import { TripTemplate } from '../models/trip-template.model';
import { 
  AccommodationDetails, 
  AirportTransfer, 
  CreateTripDto, 
  FlightDetails, 
  Trip, 
  TripActivity, 
  TripExpense,
  TripPlaceToEat,
  deriveTripStatus,
  isProposal
} from '../models/trip.model';
import { addDaysIso } from '../utils/date.utils';

@Injectable({
  providedIn: 'root'
})
export class TripService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private groupService = inject(GroupService);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  /**
   * Viaggi eliminati in questa sessione: una lista caricata prima dell'eliminazione ma arrivata
   * dopo li conterrebbe ancora e li farebbe ricomparire.
   */
  private readonly deletedIds = new Set<string>();

  /**
   * Elementi (attività, locali, spese) appena aggiunti e non ancora confermati dal server,
   * per id locale: la promessa dà l'id assegnato dal server (null se la creazione è fallita).
   */
  private readonly pendingCreates = new Map<string, Promise<string | null>>();

  /**
   * Id locale → id del server. L'id degli elementi lo decide sempre il server: chi ha ancora
   * in mano l'id locale (es. una modale aperta prima della risposta) deve trovare l'elemento.
   */
  private readonly savedIds = new Map<string, string>();

  // Viaggi con id provvisorio (trip_<timestamp>) lasciati in cache da versioni precedenti:
  // non esistono sul server, quindi non vanno mostrati (i dati demo locali usano lo stesso prefisso).
  private tripsSignal = signal<Trip[]>(this.cachedTrips());
  public readonly trips = this.tripsSignal.asReadonly();

  // Confirmed trips for the active group, with the status derived from their dates
  public readonly activeGroupTrips = computed(() => {
    const activeGroup = this.groupService.activeGroup();
    if (!activeGroup) return [];
    return this.tripsSignal()
      .filter(t => t.groupId === activeGroup.id && !isProposal(t))
      .map(t => ({ ...t, status: deriveTripStatus(t) }));
  });

  // Stats
  public readonly stats = computed(() => {
    const activeTrips = this.activeGroupTrips();
    const total = activeTrips.length;
    const upcoming = activeTrips.filter(t => t.status === 'upcoming').length;
    const uniqueCountries = new Set(activeTrips.map(t => t.country).filter(Boolean)).size;

    return {
      total,
      upcoming,
      uniqueCountries
    };
  });

  private cachedTrips(): Trip[] {
    const cached = this.storageService.getTrips();
    if (USE_MOCK_DATA) return cached;
    const synced = cached.filter(t => !t.id.startsWith('trip_'));
    if (synced.length !== cached.length) this.storageService.setTrips(synced);
    return synced;
  }

  constructor() {
    // Logout: niente viaggi dell'utente precedente in memoria.
    effect(() => {
      if (!this.authService.currentUser()) this.tripsSignal.set([]);
    });

    // When active group changes, fetch trips for that group from backend
    effect(() => {
      const activeGroup = this.groupService.activeGroup();
      if (activeGroup) {
        this.loadTripsByGroup(activeGroup.id);
      }
    });
  }

  /**
   * Loads a single trip from the backend when its page is opened. Only the active group's
   * trips are preloaded, so a direct link to another group's trip would otherwise show
   * "Viaggio non trovato"; and a copy already in cache may be stale (changes made by other
   * members), so it is replaced by the server's one.
   */
  public ensureTripLoaded(id: string): void {
    if (USE_MOCK_DATA || id.startsWith('trip_')) return;
    this.apiService.get<Trip>(`/api/v1/trips/${id}`).subscribe({
      next: (trip) => {
        if (!trip || this.deletedIds.has(trip.id)) return;
        this.addLocalTrip(trip, false);
      },
      error: (err) => {
        // 404: the trip does not exist (any more), the page shows "Viaggio non trovato".
        if (err.status === 404) this.setLocalTrips(this.tripsSignal().filter(t => t.id !== id));
        else console.warn('Could not load trip:', err.status);
      }
    });
  }

  public loadTripsByGroup(groupId: string): void {
    if (USE_MOCK_DATA) return;
    this.apiService.get<Trip[]>(`/api/v1/trips/group/${groupId}`).subscribe({
      next: (trips) => {
        // Risposta arrivata dopo il logout: non va rimessa in cache.
        if (!this.authService.currentUser()) return;
        if (trips) {
          const otherTrips = this.tripsSignal().filter(t => t.groupId !== groupId);
          const merged = [...trips.filter(t => !this.deletedIds.has(t.id)).map(t => this.withPendingChildren(t)), ...otherTrips];
          this.tripsSignal.set(merged);
          this.storageService.setTrips(merged);
        }
      },
      error: (err) => {
        console.warn('Backend unavailable, using cached trips:', err.status, err.error?.message || err.message);
      }
    });
  }

  /**
   * Crea il viaggio sul server e lo aggiunge alla lista solo dopo la conferma: niente id
   * locali provvisori, quindi niente viaggi fantasma in caso di errore e le modifiche fatte
   * subito dopo partono già con l'id definitivo. In caso di errore mostra un toast e
   * propaga l'errore (chi chiama riabilita il form).
   */
  public createTrip(dto: CreateTripDto): Observable<Trip> {
    const { asProposal, ...fields } = dto;
    return this.apiService.post<Trip>('/api/v1/trips', {
      ...fields,
      decision: asProposal ? 'proposal' : 'confirmed'
    }).pipe(
      tap({
        next: (created) => {
          this.addLocalTrip(created);
          this.toastService.success(asProposal
            ? `Proposta "${created.title}" creata: ora il gruppo può votarla.`
            : `Viaggio "${created.title}" creato con successo! 🎒`);
        },
        error: (err) => this.warnFailure('creare il viaggio', err, 'Non è stato possibile creare il viaggio. Riprova.')
      })
    );
  }

  /**
   * Clones an "Esplora" template into a regular trip of the group (new ids, dates from `startDate`).
   * Saved on the backend first (trip, then activities, places and accommodation) and added to the
   * list only once everything is stored; if a part fails the half-created trip is removed again.
   */
  public createTripFromTemplate(template: TripTemplate, groupId: string, startDate: string): Observable<Trip> {
    const endDate = addDaysIso(startDate, Math.max(template.durationDays, 1) - 1);

    const base = {
      groupId,
      title: template.title,
      destination: template.destination,
      country: template.country,
      startDate,
      endDate,
      coverUrl: template.coverUrl,
      decision: 'confirmed',
      budgetEstimate: template.budgetEstimate,
      currency: template.currency,
      tags: [...template.tags],
      notes: [`Ispirato all'itinerario di ${template.authorName}.`, template.notes].filter(Boolean).join('\n\n')
    };
    // Senza id: li assegna il backend (quelli del modello si ripeterebbero a ogni assegnazione).
    const activities = template.activities.map(({ id: _id, tripId: _t, ...a }) => ({ ...a, isCompleted: false }));
    const placesToEat = template.placesToEat.map(({ id: _id, tripId: _t, ...p }) => ({ ...p, isVisited: false }));
    const accommodation = template.accommodation ? { ...template.accommodation } : undefined;

    return this.apiService.post<Trip>('/api/v1/trips', base).pipe(
      switchMap(created => {
        const children = [
          ...activities.map(a => this.apiService.post(`/api/v1/trips/${created.id}/activities`, a)),
          ...placesToEat.map(p => this.apiService.post(`/api/v1/trips/${created.id}/places-to-eat`, p)),
          ...(accommodation ? [this.apiService.put(`/api/v1/trips/${created.id}/accommodation`, accommodation)] : [])
        ];
        return (children.length ? forkJoin(children) : of([])).pipe(
          switchMap(() => this.apiService.get<Trip>(`/api/v1/trips/${created.id}`)),
          // Salvato a metà: meglio nessun viaggio che uno senza metà delle attività.
          catchError(err => this.apiService.delete(`/api/v1/trips/${created.id}`).pipe(
            catchError(() => of(null)),
            switchMap(() => throwError(() => err))
          ))
        );
      }),
      tap({
        next: (saved) => this.addLocalTrip(saved),
        error: (err) => this.warnFailure('salvare l\'itinerario', err, 'Non è stato possibile salvare il viaggio sul server. Riprova.')
      })
    );
  }

  /**
   * Mette in lista la copia del server (in testa, o al posto di quella locale). Gli elementi
   * aggiunti in locale e non ancora confermati dal server restano, per non farli sparire.
   */
  private addLocalTrip(trip: Trip, toFront = true): void {
    const current = this.getTripById(trip.id);
    const merged = this.withPendingChildren(trip);
    this.setLocalTrips(current && !toFront
      ? this.tripsSignal().map(t => t.id === trip.id ? merged : t)
      : [merged, ...this.tripsSignal().filter(t => t.id !== trip.id)]);
  }

  /** La copia del server più gli elementi locali non ancora confermati (altrimenti sparirebbero). */
  private withPendingChildren(trip: Trip): Trip {
    const current = this.getTripById(trip.id);
    if (!current || this.pendingCreates.size === 0) return trip;
    const keep = <T extends { id: string }>(local: T[] | undefined, server: T[] | undefined): T[] => [
      ...(server ?? []),
      ...(local ?? []).filter(i => this.pendingCreates.has(i.id) && !(server ?? []).some(s => s.id === i.id))
    ];
    return {
      ...trip,
      activities: keep(current.activities, trip.activities),
      placesToEat: keep(current.placesToEat, trip.placesToEat),
      expenses: keep(current.expenses, trip.expenses)
    };
  }

  /** Errore di salvataggio gestito: avviso all'utente (non è un errore inatteso dell'app). */
  private warnFailure(action: string, err: unknown, message = `Non è stato possibile ${action}: modifica annullata.`): void {
    const e = err as { status?: number; message?: string };
    console.warn(`Could not ${action} on backend:`, e?.status, e?.message);
    this.toastService.error(message);
  }

  /** Votes that still count: only from current members of the group. */
  public validVotes(trip: Trip): string[] {
    const members = this.groupService.getGroupById(trip.groupId)?.members ?? [];
    return (trip.votes ?? []).filter(v => members.some(m => m.id === v));
  }

  /** Votes required to confirm a proposal: strict majority of the group members. */
  public votesNeeded(trip: Trip): number {
    const count = this.groupService.getGroupById(trip.groupId)?.members.length ?? 1;
    return Math.floor(count / 2) + 1;
  }

  /**
   * Aggiunge o toglie il voto dell'utente con POST /vote: il server applica il voto in modo
   * atomico (voti quasi simultanei contano tutti) e decide lui la conferma per maggioranza.
   * In locale il voto si vede subito; poi vale la risposta del server (anche i voti degli altri).
   */
  public toggleVote(tripId: string): void {
    const user = this.authService.currentUser();
    const trip = this.tripsSignal().find(t => t.id === tripId);
    if (!user || !trip || !isProposal(trip)) return;
    const group = this.groupService.getGroupById(trip.groupId);
    if (!group?.members.some(m => m.id === user.id)) return;

    const previousVotes = trip.votes ?? [];
    const voted = !previousVotes.includes(user.id);
    this.patchLocalTrip(tripId, {
      votes: voted ? [...previousVotes, user.id] : previousVotes.filter(v => v !== user.id)
    });

    this.apiService.post<Trip>(`/api/v1/trips/${tripId}/vote`, { voted }).subscribe({
      next: (saved) => {
        this.patchLocalTrip(tripId, { votes: saved.votes ?? [], decision: saved.decision });
        if (saved.decision === 'confirmed') {
          this.toastService.success(`"${saved.title}" è stato scelto dal gruppo! 🎉`);
        }
      },
      error: (err) => {
        this.patchLocalTrip(tripId, { votes: previousVotes });
        if (err?.status === 409) {
          // Non è più una proposta (es. confermata nel frattempo dai voti degli altri): si ricarica.
          console.warn('Vote rejected: the trip is no longer a proposal');
          this.ensureTripLoaded(tripId);
          return;
        }
        this.warnFailure('registrare il voto', err, 'Non è stato possibile registrare il voto. Riprova.');
      }
    });
  }

  public getTripById(id: string): Trip | undefined {
    return this.tripsSignal().find(t => t.id === id);
  }

  /**
   * Aggiorna i campi del viaggio: subito in locale, poi sul server. Al server vanno solo i
   * campi cambiati, mai le liste (attività, locali, spese, voti), che hanno i loro endpoint:
   * rimandare la propria copia cancellerebbe le modifiche fatte nel frattempo da altri membri.
   * In caso di errore i campi tornano ai valori precedenti e l'utente viene avvisato.
   */
  public updateTrip(id: string, partial: Partial<Trip>): Trip | undefined {
    const found = this.getTripById(id);
    if (!found) return undefined;

    const fields = Object.fromEntries(
      Object.entries(partial).filter(([key]) => !LIST_KEYS.includes(key as keyof Trip))
    ) as Partial<Trip>;
    const previous = Object.fromEntries(Object.keys(fields).map(k => [k, found[k as keyof Trip]])) as Partial<Trip>;
    this.patchLocalTrip(id, fields);

    this.apiService.put<Trip>(`/api/v1/trips/${id}`, fields).subscribe({
      // La copia del server è la più aggiornata: comprende anche le modifiche degli altri membri.
      next: (syncedTrip) => this.patchLocalTrip(id, this.withPendingChildren(syncedTrip)),
      error: (err) => {
        this.patchLocalTrip(id, previous);
        this.warnFailure('salvare le modifiche al viaggio', err);
      }
    });

    return { ...found, ...fields };
  }

  public deleteTrip(id: string): void {
    const index = this.tripsSignal().findIndex(t => t.id === id);
    if (index < 0) return;
    const found = this.tripsSignal()[index];
    this.deletedIds.add(id);
    this.setLocalTrips(this.tripsSignal().filter(t => t.id !== id));

    this.apiService.delete(`/api/v1/trips/${id}`).subscribe({
      next: () => this.toastService.info(`Viaggio "${found.title}" rimosso.`),
      error: (err) => {
        // Già eliminato sul server (es. da un altro membro): il risultato è quello voluto.
        if (err?.status === 404) {
          this.toastService.info(`Viaggio "${found.title}" rimosso.`);
          return;
        }
        // Non eliminato: torna al suo posto e le prossime liste lo devono mostrare di nuovo.
        this.deletedIds.delete(id);
        if (!this.getTripById(id)) {
          const list = [...this.tripsSignal()];
          list.splice(Math.min(index, list.length), 0, found);
          this.setLocalTrips(list);
        }
        this.warnFailure('eliminare il viaggio', err, err?.status === 403
          ? `Solo gli amministratori del gruppo possono eliminare il viaggio "${found.title}".`
          : `Non è stato possibile eliminare il viaggio "${found.title}". Riprova.`);
      }
    });
  }

  // Activity Management
  public addActivity(tripId: string, activity: Omit<TripActivity, 'id' | 'tripId'>): TripActivity {
    const newAct: TripActivity = { ...activity, id: localId('act'), tripId };
    this.addChild(tripId, 'activities', newAct, {
      success: `Attrazione "${newAct.name}" aggiunta! 🏛️`,
      action: `aggiungere l'attrazione "${newAct.name}"`
    });
    return newAct;
  }

  public updateActivity(tripId: string, activityId: string, partial: Partial<TripActivity>): void {
    this.updateChild(tripId, 'activities', activityId, partial, {
      success: 'Attrazione aggiornata!',
      action: 'aggiornare l\'attrazione'
    });
  }

  public deleteActivity(tripId: string, activityId: string): void {
    this.deleteChild(tripId, 'activities', activityId, {
      success: 'Attrazione rimossa dal viaggio.',
      action: 'rimuovere l\'attrazione'
    });
  }

  // Food / Places to Eat Management
  public addPlaceToEat(tripId: string, place: Omit<TripPlaceToEat, 'id' | 'tripId'>): TripPlaceToEat {
    const newPlace: TripPlaceToEat = { ...place, id: localId('eat'), tripId };
    this.addChild(tripId, 'placesToEat', newPlace, {
      success: `Posto "${newPlace.name}" aggiunto ai ristoranti! 🍽️`,
      action: `aggiungere il locale "${newPlace.name}"`
    });
    return newPlace;
  }

  public updatePlaceToEat(tripId: string, placeId: string, partial: Partial<TripPlaceToEat>): void {
    this.updateChild(tripId, 'placesToEat', placeId, partial, {
      success: 'Locale aggiornato!',
      action: 'aggiornare il locale'
    });
  }

  public deletePlaceToEat(tripId: string, placeId: string): void {
    this.deleteChild(tripId, 'placesToEat', placeId, {
      success: 'Locale rimosso.',
      action: 'rimuovere il locale'
    });
  }

  /**
   * Nuovo ordine delle tappe del giorno `day` (attività e ristoranti insieme): la posizione nell'elenco
   * diventa `dayOrder`. Aggiornato subito in locale e salvato con un'unica richiesta; se fallisce si ripristina.
   */
  public reorderDayStops(tripId: string, day: number, stops: DayStopRef[]): void {
    const trip = this.getTripById(tripId);
    if (!trip) return;
    const previous = { activities: trip.activities, placesToEat: trip.placesToEat };
    const position = new Map(stops.map((s, i) => [`${s.type}:${s.id}`, i]));
    const withOrder = <T extends { id: string; dayOrder?: number | null }>(items: T[] | undefined, type: DayStopRef['type']): T[] =>
      (items ?? []).map(i => position.has(`${type}:${i.id}`) ? { ...i, dayOrder: position.get(`${type}:${i.id}`)! } : i);
    this.patchLocalTrip(tripId, {
      activities: withOrder(trip.activities, 'activity'),
      placesToEat: withOrder(trip.placesToEat, 'food')
    });

    this.apiService.put<Trip>(`/api/v1/trips/${tripId}/days/${day}/order`, { items: stops }).subscribe({
      error: (err) => {
        this.patchLocalTrip(tripId, previous);
        this.warnFailure('salvare l\'ordine delle tappe', err);
      }
    });
  }

  // Flights & Logistics Management
  public updateFlights(tripId: string, flights: FlightDetails): void {
    this.updateLogistics(tripId, 'flights', flights, 'Dettagli voli salvati! ✈️', 'salvare i voli');
  }

  public updateTransfers(tripId: string, transfers: AirportTransfer): void {
    this.updateLogistics(tripId, 'transfers', transfers, 'Informazioni spostamenti aeroporto salvate! 🚇', 'salvare gli spostamenti');
  }

  public updateAccommodation(tripId: string, accommodation: AccommodationDetails): void {
    this.updateLogistics(tripId, 'accommodation', accommodation, 'Dettagli hotel aggiornati! 🏨', 'salvare l\'alloggio');
  }

  // Expenses Management
  public addExpense(tripId: string, expense: Omit<TripExpense, 'id' | 'tripId'>): TripExpense | undefined {
    if (!this.getTripById(tripId)) return undefined;
    const created: TripExpense = { ...expense, id: localId('exp'), tripId };
    const isSettlement = expense.type === 'settlement';
    this.addChild(tripId, 'expenses', created, {
      success: isSettlement ? 'Pagamento registrato!' : `Spesa "${created.title}" aggiunta! 💸`,
      action: isSettlement ? 'registrare il pagamento' : `aggiungere la spesa "${created.title}"`
    });
    return created;
  }

  public updateExpense(tripId: string, expenseId: string, partial: Partial<Omit<TripExpense, 'id' | 'tripId'>>): void {
    this.updateChild(tripId, 'expenses', expenseId, partial, {
      success: 'Spesa aggiornata!',
      action: 'aggiornare la spesa'
    });
  }

  public deleteExpense(tripId: string, expenseId: string): void {
    this.deleteChild(tripId, 'expenses', expenseId, {
      success: 'Spesa rimossa.',
      action: 'rimuovere la spesa'
    });
  }

  // ── Sincronizzazione ottimistica, con ripristino in caso di errore ─────────

  private setLocalTrips(trips: Trip[]): void {
    this.tripsSignal.set(trips);
    this.storageService.setTrips(trips);
  }

  /**
   * Updates the trip in the local state only. For activities, places and logistics the
   * backend is updated by their dedicated endpoint: a full PUT of the trip as well would
   * write the same rows twice (duplicate key → 503).
   */
  private patchLocalTrip(tripId: string, partial: Partial<Trip>): void {
    this.setLocalTrips(this.tripsSignal().map(t => t.id === tripId ? { ...t, ...partial } : t));
  }

  /** Applica `fn` alla lista `key` del viaggio, partendo dallo stato più recente. */
  private patchChildren<K extends ChildKey>(tripId: string, key: K, fn: (items: ChildOf<K>[]) => ChildOf<K>[]): void {
    const trip = this.getTripById(tripId);
    if (!trip) return;
    this.patchLocalTrip(tripId, { [key]: fn((trip[key] ?? []) as ChildOf<K>[]) } as Partial<Trip>);
  }

  /**
   * Esegue `request` solo dopo che l'elemento appena aggiunto è stato salvato sul server:
   * una modifica immediata altrimenti arriverebbe prima della creazione (404).
   * Se la creazione è fallita l'elemento non esiste più e la modifica viene scartata.
   */
  private afterSaved<T>(itemId: string, request: (savedId: string) => Observable<T>): Observable<T> {
    const pending = this.pendingCreates.get(itemId);
    if (!pending) return request(this.serverId(itemId));
    return from(pending).pipe(switchMap(savedId => savedId ? request(savedId) : EMPTY));
  }

  /** L'id del server per un id forse ancora locale (vedi `savedIds`). */
  private serverId(id: string): string {
    return this.savedIds.get(id) ?? id;
  }

  private addChild<K extends ChildKey>(tripId: string, key: K, item: ChildOf<K>, msg: SyncMessages): void {
    if (!this.getTripById(tripId)) return;
    this.patchChildren(tripId, key, items => [...items, item]);

    let settle: (savedId: string | null) => void = () => undefined;
    this.pendingCreates.set(item.id, new Promise<string | null>(resolve => settle = resolve));
    // L'id locale non viene inviato: lo assegna il server.
    const { id: _localId, ...body } = item;
    this.apiService.post<ChildOf<K>>(`/api/v1/trips/${tripId}/${CHILD_PATHS[key]}`, body).pipe(
      finalize(() => this.pendingCreates.delete(item.id))
    ).subscribe({
      next: (saved) => {
        this.savedIds.set(item.id, saved.id);
        // I dati locali prevalgono (l'elemento può essere già stato modificato nel frattempo),
        // tranne l'id, che diventa quello del server. Una copia del server arrivata nel
        // frattempo può già contenerlo: niente doppioni.
        this.patchChildren(tripId, key, items => items
          .filter(i => i.id !== saved.id)
          .map(i => i.id === item.id ? { ...saved, ...i, id: saved.id } : i));
        this.toastService.success(msg.success);
        settle(saved.id);
      },
      error: (err) => {
        this.patchChildren(tripId, key, items => items.filter(i => i.id !== item.id));
        this.warnFailure(msg.action, err);
        settle(null);
      }
    });
  }

  private updateChild<K extends ChildKey>(tripId: string, key: K, itemId: string, partial: Partial<ChildOf<K>>, msg: SyncMessages): void {
    const knownId = this.serverId(itemId);
    const target = ((this.getTripById(tripId)?.[key] ?? []) as ChildOf<K>[]).find(i => i.id === knownId);
    if (!target) return;
    const merged = { ...target, ...partial } as ChildOf<K>;
    this.patchChildren(tripId, key, items => items.map(i => i.id === knownId ? merged : i));
    // Se l'elemento è ancora in creazione, nel frattempo il suo id diventa quello del server.
    const current = () => this.serverId(knownId);

    this.afterSaved(knownId, savedId =>
      this.apiService.put<ChildOf<K>>(`/api/v1/trips/${tripId}/${CHILD_PATHS[key]}/${savedId}`, { ...merged, id: savedId })
    ).subscribe({
      next: () => {
        // Riapplicata: una copia del server arrivata nel frattempo potrebbe averla sovrascritta.
        this.patchChildren(tripId, key, items => items.map(i => i.id === current() ? { ...merged, id: current() } : i));
        this.toastService.success(msg.success);
      },
      error: (err) => {
        this.patchChildren(tripId, key, items => items.map(i => i.id === current() ? { ...target, id: current() } : i));
        this.warnFailure(msg.action, err);
      }
    });
  }

  private deleteChild<K extends ChildKey>(tripId: string, key: K, itemId: string, msg: SyncMessages): void {
    const knownId = this.serverId(itemId);
    const before = (this.getTripById(tripId)?.[key] ?? []) as ChildOf<K>[];
    const index = before.findIndex(i => i.id === knownId);
    if (index < 0) return;
    const target = before[index];
    this.patchChildren(tripId, key, items => items.filter(i => i.id !== knownId));

    this.afterSaved(knownId, savedId =>
      this.apiService.delete(`/api/v1/trips/${tripId}/${CHILD_PATHS[key]}/${savedId}`)
    ).subscribe({
      next: () => this.toastService.info(msg.success),
      error: (err) => {
        if (err?.status === 404) return; // già rimosso sul server
        const id = this.serverId(knownId);
        this.patchChildren(tripId, key, items => {
          if (items.some(i => i.id === id)) return items;
          const restored = [...items];
          restored.splice(Math.min(index, restored.length), 0, { ...target, id });
          return restored;
        });
        this.warnFailure(msg.action, err);
      }
    });
  }

  private updateLogistics<K extends 'flights' | 'transfers' | 'accommodation'>(
    tripId: string, key: K, value: Trip[K], success: string, action: string
  ): void {
    const trip = this.getTripById(tripId);
    if (!trip) return;
    const previous = trip[key];
    this.patchLocalTrip(tripId, { [key]: value } as Partial<Trip>);

    this.apiService.put<Trip>(`/api/v1/trips/${tripId}/${key}`, value).subscribe({
      next: () => this.toastService.success(success),
      error: (err) => {
        this.patchLocalTrip(tripId, { [key]: previous } as Partial<Trip>);
        this.warnFailure(action, err);
      }
    });
  }
}

/** Liste del viaggio con endpoint propri: non vanno mai rimandate con il PUT del viaggio. */
const LIST_KEYS: (keyof Trip)[] = ['activities', 'placesToEat', 'expenses', 'votes'];

type ChildKey ='activities' | 'placesToEat' | 'expenses';
type ChildOf<K extends ChildKey> = K extends 'activities' ? TripActivity : K extends 'placesToEat' ? TripPlaceToEat : TripExpense;
interface SyncMessages { success: string; action: string; }

/** Una tappa della giornata, per salvarne l'ordine. */
export interface DayStopRef { type: 'activity' | 'food'; id: string; }

const CHILD_PATHS: Record<ChildKey, string> = {
  activities: 'activities',
  placesToEat: 'places-to-eat',
  expenses: 'expenses'
};

/** Id provvisorio, solo nel browser: il server assegna quello definitivo (vedi `savedIds`). */
function localId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

import { Injectable, computed, effect, inject, signal } from '@angular/core';
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

@Injectable({
  providedIn: 'root'
})
export class TripService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private groupService = inject(GroupService);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  private tripsSignal = signal<Trip[]>(this.storageService.getTrips());
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

  constructor() {
    // When active group changes, fetch trips for that group from backend
    effect(() => {
      const activeGroup = this.groupService.activeGroup();
      if (activeGroup) {
        this.loadTripsByGroup(activeGroup.id);
      }
    });
  }

  public loadTripsByGroup(groupId: string): void {
    if (USE_MOCK_DATA) return;
    this.apiService.get<Trip[]>(`/api/v1/trips/group/${groupId}`).subscribe({
      next: (trips) => {
        if (trips) {
          const otherTrips = this.tripsSignal().filter(t => t.groupId !== groupId);
          const merged = [...trips, ...otherTrips];
          this.tripsSignal.set(merged);
          this.storageService.setTrips(merged);
        }
      },
      error: (err) => {
        console.warn('Backend unavailable, using cached trips:', err.status, err.error?.message || err.message);
      }
    });
  }

  public createTrip(dto: CreateTripDto): Trip {
    const localTrip: Trip = {
      id: 'trip_' + Date.now(),
      groupId: dto.groupId,
      title: dto.title.trim(),
      destination: dto.destination.trim(),
      country: dto.country.trim(),
      startDate: dto.startDate,
      endDate: dto.endDate,
      coverUrl: dto.coverUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
      status: 'planning',
      decision: dto.asProposal ? 'proposal' : 'confirmed',
      proposedBy: dto.asProposal ? this.authService.currentUser()?.id : undefined,
      votes: dto.asProposal ? [] : undefined,
      budgetEstimate: dto.budgetEstimate || 0,
      currency: dto.currency || 'EUR',
      tags: dto.tags && dto.tags.length > 0 ? dto.tags : ['Viaggio', 'Gourmet'],
      notes: dto.notes?.trim() || '',
      createdAt: new Date().toISOString().split('T')[0],
      activities: [],
      placesToEat: []
    };

    const updated = [localTrip, ...this.tripsSignal()];
    this.tripsSignal.set(updated);
    this.storageService.setTrips(updated);

    // Sync to backend
    this.apiService.post<Trip>('/api/v1/trips', {
      ...dto,
      decision: localTrip.decision,
      proposedBy: localTrip.proposedBy
    }).subscribe({
      next: (created) => {
        const synced = this.tripsSignal().map(t => t.id === localTrip.id ? created : t);
        this.tripsSignal.set(synced);
        this.storageService.setTrips(synced);
      },
      error: (err) => {
        console.error('Error creating trip on backend:', err);
      }
    });

    this.toastService.success(dto.asProposal
      ? `Proposta "${dto.title}" creata: ora il gruppo può votarla.`
      : `Viaggio "${dto.title}" creato con successo! 🎒`);
    return localTrip;
  }

  /**
   * Clones an "Esplora" template into a regular trip of the group (new ids, dates from `startDate`).
   * Stored locally only: the backend has no template/bulk-activities endpoints yet, and syncing the trip
   * alone would replace it with a response without activities (see TECHNICAL_DEBT.md).
   */
  public createTripFromTemplate(template: TripTemplate, groupId: string, startDate: string): Trip {
    const stamp = Date.now();
    const id = 'trip_' + stamp;
    const end = new Date(startDate + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + Math.max(template.durationDays, 1) - 1);
    const endDate = end.toISOString().split('T')[0];
    const uid = (prefix: string, i: number) => `${prefix}_${stamp}_${i}`;

    const trip: Trip = {
      id,
      groupId,
      title: template.title,
      destination: template.destination,
      country: template.country,
      startDate,
      endDate,
      coverUrl: template.coverUrl,
      status: 'planning',
      decision: 'confirmed',
      budgetEstimate: template.budgetEstimate,
      currency: template.currency,
      tags: [...template.tags],
      notes: [`Ispirato all'itinerario di ${template.authorName}.`, template.notes].filter(Boolean).join('\n\n'),
      createdAt: new Date().toISOString().split('T')[0],
      activities: template.activities.map((a, i) => ({ ...a, id: uid('act', i), tripId: id, isCompleted: false })),
      placesToEat: template.placesToEat.map((p, i) => ({ ...p, id: uid('eat', i), tripId: id, isVisited: false })),
      accommodation: template.accommodation ? { ...template.accommodation } : undefined
    };

    const updated = [trip, ...this.tripsSignal()];
    this.tripsSignal.set(updated);
    this.storageService.setTrips(updated);
    return trip;
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

  /** Adds or removes the current user's vote; confirms the proposal when the majority is reached. */
  public toggleVote(tripId: string): void {
    const user = this.authService.currentUser();
    const trip = this.tripsSignal().find(t => t.id === tripId);
    if (!user || !trip || !isProposal(trip)) return;
    const group = this.groupService.getGroupById(trip.groupId);
    if (!group?.members.some(m => m.id === user.id)) return;

    const has = (trip.votes ?? []).includes(user.id);
    const votes = has ? (trip.votes ?? []).filter(v => v !== user.id) : [...(trip.votes ?? []), user.id];
    const next: Trip = { ...trip, votes };
    const confirmed = this.validVotes(next).length >= this.votesNeeded(next);

    this.updateTrip(tripId, confirmed ? { votes, decision: 'confirmed' } : { votes });
    if (confirmed) {
      this.toastService.success(`"${trip.title}" è stato scelto dal gruppo! 🎉`);
    }
  }

  public getTripById(id: string): Trip | undefined {
    return this.tripsSignal().find(t => t.id === id);
  }

  public updateTrip(id: string, partial: Partial<Trip>): Trip | undefined {
    const found = this.tripsSignal().find(t => t.id === id);
    if (!found) return undefined;

    const updatedTrip = { ...found, ...partial };
    const updatedAll = this.tripsSignal().map(t => t.id === id ? updatedTrip : t);

    this.tripsSignal.set(updatedAll);
    this.storageService.setTrips(updatedAll);

    // Sync to backend
    this.apiService.put<Trip>(`/api/v1/trips/${id}`, updatedTrip).subscribe({
      next: (syncedTrip) => {
        const synced = this.tripsSignal().map(t => t.id === id ? syncedTrip : t);
        this.tripsSignal.set(synced);
        this.storageService.setTrips(synced);
      },
      error: (err) => {
        console.error('Error updating trip on backend:', err);
      }
    });

    return updatedTrip;
  }

  public deleteTrip(id: string): void {
    const found = this.tripsSignal().find(t => t.id === id);
    const updated = this.tripsSignal().filter(t => t.id !== id);
    this.tripsSignal.set(updated);
    this.storageService.setTrips(updated);

    if (found) {
      this.toastService.info(`Viaggio "${found.title}" rimosso.`);
    }

    // Sync to backend
    this.apiService.delete(`/api/v1/trips/${id}`).subscribe({
      error: (err) => console.error('Error deleting trip on backend:', err)
    });
  }

  // Activity Management
  public addActivity(tripId: string, activity: Omit<TripActivity, 'id' | 'tripId'>): TripActivity {
    const newAct: TripActivity = {
      ...activity,
      id: 'act_' + Date.now(),
      tripId
    };

    const trip = this.getTripById(tripId);
    if (trip) {
      const activities = [...(trip.activities || []), newAct];
      this.updateTrip(tripId, { activities });
      this.toastService.success(`Attrazione "${newAct.name}" aggiunta! 🏛️`);
    }

    // Direct endpoint sync
    this.apiService.post<TripActivity>(`/api/v1/trips/${tripId}/activities`, newAct).subscribe({
      next: (savedAct) => {
        const currentTrip = this.getTripById(tripId);
        if (currentTrip && currentTrip.activities) {
          const acts = currentTrip.activities.map(a => a.id === newAct.id ? savedAct : a);
          this.updateTrip(tripId, { activities: acts });
        }
      },
      error: (err) => console.error('Error adding activity to backend:', err)
    });

    return newAct;
  }

  public updateActivity(tripId: string, activityId: string, partial: Partial<TripActivity>): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.activities) return;

    const target = trip.activities.find(a => a.id === activityId);
    if (!target) return;
    const merged = { ...target, ...partial };

    const updatedActivities = trip.activities.map(a => a.id === activityId ? merged : a);
    this.updateTrip(tripId, { activities: updatedActivities });
    this.toastService.success('Attrazione aggiornata!');

    this.apiService.put<TripActivity>(`/api/v1/trips/${tripId}/activities/${activityId}`, merged).subscribe({
      error: (err) => console.error('Error updating activity on backend:', err)
    });
  }

  public deleteActivity(tripId: string, activityId: string): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.activities) return;

    const updatedActivities = trip.activities.filter(a => a.id !== activityId);
    this.updateTrip(tripId, { activities: updatedActivities });
    this.toastService.info('Attrazione rimossa dal viaggio.');

    this.apiService.delete(`/api/v1/trips/${tripId}/activities/${activityId}`).subscribe({
      error: (err) => console.error('Error deleting activity on backend:', err)
    });
  }

  // Food / Places to Eat Management
  public addPlaceToEat(tripId: string, place: Omit<TripPlaceToEat, 'id' | 'tripId'>): TripPlaceToEat {
    const newPlace: TripPlaceToEat = {
      ...place,
      id: 'eat_' + Date.now(),
      tripId
    };

    const trip = this.getTripById(tripId);
    if (trip) {
      const placesToEat = [...(trip.placesToEat || []), newPlace];
      this.updateTrip(tripId, { placesToEat });
      this.toastService.success(`Posto "${newPlace.name}" aggiunto ai ristoranti! 🍽️`);
    }

    this.apiService.post<TripPlaceToEat>(`/api/v1/trips/${tripId}/places-to-eat`, newPlace).subscribe({
      next: (savedPlace) => {
        const currentTrip = this.getTripById(tripId);
        if (currentTrip && currentTrip.placesToEat) {
          const places = currentTrip.placesToEat.map(p => p.id === newPlace.id ? savedPlace : p);
          this.updateTrip(tripId, { placesToEat: places });
        }
      },
      error: (err) => console.error('Error adding place to eat to backend:', err)
    });

    return newPlace;
  }

  public updatePlaceToEat(tripId: string, placeId: string, partial: Partial<TripPlaceToEat>): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.placesToEat) return;

    const target = trip.placesToEat.find(p => p.id === placeId);
    if (!target) return;
    const merged = { ...target, ...partial };

    const updatedPlaces = trip.placesToEat.map(p => p.id === placeId ? merged : p);
    this.updateTrip(tripId, { placesToEat: updatedPlaces });
    this.toastService.success('Locale aggiornato!');

    this.apiService.put<TripPlaceToEat>(`/api/v1/trips/${tripId}/places-to-eat/${placeId}`, merged).subscribe({
      error: (err) => console.error('Error updating place to eat on backend:', err)
    });
  }

  public deletePlaceToEat(tripId: string, placeId: string): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.placesToEat) return;

    const updatedPlaces = trip.placesToEat.filter(p => p.id !== placeId);
    this.updateTrip(tripId, { placesToEat: updatedPlaces });
    this.toastService.info('Locale rimosso.');

    this.apiService.delete(`/api/v1/trips/${tripId}/places-to-eat/${placeId}`).subscribe({
      error: (err) => console.error('Error deleting place to eat on backend:', err)
    });
  }

  // Flights & Logistics Management
  public updateFlights(tripId: string, flights: FlightDetails): void {
    this.updateTrip(tripId, { flights });
    this.toastService.success('Dettagli voli salvati! ✈️');
    this.apiService.put<Trip>(`/api/v1/trips/${tripId}/flights`, flights).subscribe({
      error: (err) => console.error('Error updating flights on backend:', err)
    });
  }

  public updateTransfers(tripId: string, transfers: AirportTransfer): void {
    this.updateTrip(tripId, { transfers });
    this.toastService.success('Informazioni spostamenti aeroporto salvate! 🚇');
    this.apiService.put<Trip>(`/api/v1/trips/${tripId}/transfers`, transfers).subscribe({
      error: (err) => console.error('Error updating transfers on backend:', err)
    });
  }

  public updateAccommodation(tripId: string, accommodation: AccommodationDetails): void {
    this.updateTrip(tripId, { accommodation });
    this.toastService.success('Dettagli hotel aggiornati! 🏨');
    this.apiService.put<Trip>(`/api/v1/trips/${tripId}/accommodation`, accommodation).subscribe({
      error: (err) => console.error('Error updating accommodation on backend:', err)
    });
  }

  // Expenses Management
  // NOTE: the backend has no expenses support yet and updateTrip() replaces the trip with the backend
  // response (which would drop them), so expenses are kept client-side only: tripsSignal + storage.
  private saveExpenses(tripId: string, expenses: TripExpense[]): void {
    const updated = this.tripsSignal().map(t => t.id === tripId ? { ...t, expenses } : t);
    this.tripsSignal.set(updated);
    this.storageService.setTrips(updated);
  }

  public addExpense(tripId: string, expense: Omit<TripExpense, 'id' | 'tripId'>): TripExpense | undefined {
    const trip = this.getTripById(tripId);
    if (!trip) return undefined;
    const created: TripExpense = {
      ...expense,
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      tripId
    };
    this.saveExpenses(tripId, [...(trip.expenses ?? []), created]);
    this.toastService.success(expense.type === 'settlement' ? 'Pagamento registrato!' : `Spesa "${created.title}" aggiunta! 💸`);
    return created;
  }

  public updateExpense(tripId: string, expenseId: string, partial: Partial<Omit<TripExpense, 'id' | 'tripId'>>): void {
    const trip = this.getTripById(tripId);
    if (!trip?.expenses?.some(e => e.id === expenseId)) return;
    this.saveExpenses(tripId, trip.expenses.map(e => e.id === expenseId ? { ...e, ...partial } : e));
    this.toastService.success('Spesa aggiornata!');
  }

  public deleteExpense(tripId: string, expenseId: string): void {
    const trip = this.getTripById(tripId);
    if (!trip?.expenses) return;
    this.saveExpenses(tripId, trip.expenses.filter(e => e.id !== expenseId));
    this.toastService.info('Spesa rimossa.');
  }
}

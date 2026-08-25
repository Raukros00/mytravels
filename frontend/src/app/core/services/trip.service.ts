import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { GroupService } from './group.service';
import { ApiService } from './api.service';
import { 
  AccommodationDetails, 
  AirportTransfer, 
  CreateTripDto, 
  FlightDetails, 
  Trip, 
  TripActivity, 
  TripPlaceToEat 
} from '../models/trip.model';

@Injectable({
  providedIn: 'root'
})
export class TripService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private groupService = inject(GroupService);
  private apiService = inject(ApiService);

  private tripsSignal = signal<Trip[]>(this.storageService.getTrips());
  public readonly trips = this.tripsSignal.asReadonly();

  // Trips for active group
  public readonly activeGroupTrips = computed(() => {
    const activeGroup = this.groupService.activeGroup();
    if (!activeGroup) return [];
    return this.tripsSignal().filter(t => t.groupId === activeGroup.id);
  });

  // Stats
  public readonly stats = computed(() => {
    const activeTrips = this.activeGroupTrips();
    const total = activeTrips.length;
    const upcoming = activeTrips.filter(t => t.status === 'upcoming' || t.status === 'planning').length;
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
        console.warn('Backend unavailable, using cached trips:', err);
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
    this.apiService.post<Trip>('/api/v1/trips', dto).subscribe({
      next: (created) => {
        const synced = this.tripsSignal().map(t => t.id === localTrip.id ? created : t);
        this.tripsSignal.set(synced);
        this.storageService.setTrips(synced);
      },
      error: (err) => {
        console.error('Error creating trip on backend:', err);
      }
    });

    this.toastService.success(`Viaggio "${dto.title}" creato con successo! 🎒`);
    return localTrip;
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
}

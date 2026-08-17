import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { GroupService } from './group.service';
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

  public createTrip(dto: CreateTripDto): Trip {
    const newTrip: Trip = {
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
      tags: dto.tags.length > 0 ? dto.tags : ['Viaggio', 'Gourmet'],
      notes: dto.notes?.trim() || '',
      createdAt: new Date().toISOString().split('T')[0],
      activities: [],
      placesToEat: []
    };

    const updated = [newTrip, ...this.tripsSignal()];
    this.tripsSignal.set(updated);
    this.storageService.setTrips(updated);

    this.toastService.success(`Viaggio "${newTrip.title}" creato con successo! 🎒`);
    return newTrip;
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

    return newAct;
  }

  public updateActivity(tripId: string, activityId: string, partial: Partial<TripActivity>): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.activities) return;

    const updatedActivities = trip.activities.map(a => a.id === activityId ? { ...a, ...partial } : a);
    this.updateTrip(tripId, { activities: updatedActivities });
    this.toastService.success('Attrazione aggiornata!');
  }

  public deleteActivity(tripId: string, activityId: string): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.activities) return;

    const updatedActivities = trip.activities.filter(a => a.id !== activityId);
    this.updateTrip(tripId, { activities: updatedActivities });
    this.toastService.info('Attrazione rimossa dal viaggio.');
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

    return newPlace;
  }

  public updatePlaceToEat(tripId: string, placeId: string, partial: Partial<TripPlaceToEat>): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.placesToEat) return;

    const updatedPlaces = trip.placesToEat.map(p => p.id === placeId ? { ...p, ...partial } : p);
    this.updateTrip(tripId, { placesToEat: updatedPlaces });
    this.toastService.success('Locale aggiornato!');
  }

  public deletePlaceToEat(tripId: string, placeId: string): void {
    const trip = this.getTripById(tripId);
    if (!trip || !trip.placesToEat) return;

    const updatedPlaces = trip.placesToEat.filter(p => p.id !== placeId);
    this.updateTrip(tripId, { placesToEat: updatedPlaces });
    this.toastService.info('Locale rimosso.');
  }

  // Flights & Logistics Management
  public updateFlights(tripId: string, flights: FlightDetails): void {
    this.updateTrip(tripId, { flights });
    this.toastService.success('Dettagli voli salvati! ✈️');
  }

  public updateTransfers(tripId: string, transfers: AirportTransfer): void {
    this.updateTrip(tripId, { transfers });
    this.toastService.success('Informazioni spostamenti aeroporto salvate! 🚇');
  }

  public updateAccommodation(tripId: string, accommodation: AccommodationDetails): void {
    this.updateTrip(tripId, { accommodation });
    this.toastService.success('Dettagli hotel aggiornati! 🏨');
  }
}

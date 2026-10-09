import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TripService } from '../../../core/services/trip.service';
import { GroupService } from '../../../core/services/group.service';
import { ToastService } from '../../../core/services/toast.service';
import { 
  AccommodationDetails, 
  ActivityCategory,
  AirportTransfer, 
  FlightDetails, 
  FoodCategory, 
  Trip, 
  TripActivity, 
  TripPlaceToEat,
  TripStatus,
  deriveTripStatus
} from '../../../core/models/trip.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { InteractiveMapComponent, MapStopPoint } from '../../../shared/components/map/interactive-map.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

export type DetailTab = 'itinerary' | 'activities' | 'food' | 'flights' | 'hotel';

export interface TimelineItem {
  id: string;
  type: 'activity' | 'food';
  name: string;
  timeSlot?: string;
  address?: string;
  notes?: string;
  priceInfo?: string;
  bookingInfo?: string;
  isCompleted?: boolean;
  raw: TripActivity | TripPlaceToEat;
}

import { TripHeroComponent } from './components/trip-hero/trip-hero.component';
import { TripItineraryComponent } from './components/trip-itinerary/trip-itinerary.component';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    ReactiveFormsModule, 
    EmptyStateComponent, 
    InteractiveMapComponent, 
    ModalComponent,
    TripHeroComponent,
    TripItineraryComponent
  ],
  templateUrl: './trip-detail.component.html',
  styleUrl: './trip-detail.component.css'
})
export class TripDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public tripService = inject(TripService);
  public groupService = inject(GroupService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  public trip = signal<Trip | undefined>(undefined);
  public activeTab = signal<DetailTab>('itinerary');
  public activeLogisticsTab = signal<'flights' | 'hotel' | 'transfers'>('flights');
  public selectedDay = signal<number>(1);
  public selectedFoodFilter = signal<FoodCategory | 'all'>('all');
  public foodSearchQuery = signal<string>('');
  public activitySearchQuery = signal<string>('');
  public showMobileDetails = signal<boolean>(false);

  public toggleMobileDetails(): void {
    this.showMobileDetails.update(v => !v);
  }

  // Modal Signals
  public isActivityModalOpen = signal(false);
  public isPlaceModalOpen = signal(false);
  public isAssignModalOpen = signal(false);
  public isFlightsModalOpen = signal(false);
  public isTransfersModalOpen = signal(false);
  public isAccommodationModalOpen = signal(false);

  // Assign Day State
  public currentAssigningItem = signal<{ item: TripActivity | TripPlaceToEat; type: 'activity' | 'food' } | null>(null);
  public assignDayTarget = 1;
  public assignTimeSlot = '';

  // Forms
  public activityForm = this.fb.group({
    name: ['', Validators.required],
    category: ['monument' as const, Validators.required],
    address: [''],
    ticketsRequired: [false],
    ticketPrice: [0],
    bookingRequired: [false],
    bookingUrl: [''],
    openingHours: [''],
    closingDays: [''],
    notes: ['']
  });

  public placeForm = this.fb.group({
    name: ['', Validators.required],
    category: ['lunch' as const, Validators.required],
    priceRange: ['€€' as const, Validators.required],
    address: [''],
    specialties: [''],
    openingHours: [''],
    closingDays: [''],
    notes: ['']
  });

  public flightsForm = this.fb.group({
    outAirline: [''],
    outFlightNum: [''],
    outDepAirport: [''],
    outDepTime: [''],
    outArrAirport: [''],
    outArrTime: [''],
    retAirline: [''],
    retFlightNum: [''],
    retDepAirport: [''],
    retDepTime: [''],
    retArrAirport: [''],
    retArrTime: [''],
    pnr: ['']
  });

  public transfersForm = this.fb.group({
    recommendedOption: ['bus' as 'metro' | 'train' | 'bus' | 'taxi' | 'uber' | 'other'],
    passDetails: [''],
    specialTickets: [''],
    taxiVsUberAdvice: [''],
    estimatedCost: [''],
    estimatedDuration: [''],
    instructions: ['']
  });

  public accommodationForm = this.fb.group({
    name: ['', Validators.required],
    address: ['', Validators.required],
    checkInDate: [''],
    checkInTime: ['14:00'],
    checkOutDate: [''],
    checkOutTime: ['11:00'],
    bookingCode: [''],
    phoneOrContact: [''],
    notes: ['']
  });

  // Computed Days Array [1, 2, 3, 4, ...]
  public tripDaysNumbers = computed(() => {
    const t = this.trip();
    if (!t || !t.startDate || !t.endDate) return [1, 2, 3];
    const s = new Date(t.startDate);
    const e = new Date(t.endDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const count = Math.max(1, Math.min(diff, 30));
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  // Derived status
  public currentTripStatus = computed<TripStatus>(() => {
    const t = this.trip();
    return t ? deriveTripStatus(t) : 'planning';
  });

  // Computed Places To Eat Filtered
  public filteredPlacesToEat = computed(() => {
    const t = this.trip();
    if (!t || !t.placesToEat) return [];
    let list = t.placesToEat;
    const filter = this.selectedFoodFilter();
    if (filter !== 'all') {
      list = list.filter(p => p.category === filter);
    }
    const q = this.foodSearchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.specialties && p.specialties.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
      );
    }
    return list;
  });

  // Computed Activities Filtered
  public filteredActivities = computed(() => {
    const t = this.trip();
    if (!t || !t.activities) return [];
    const q = this.activitySearchQuery().trim().toLowerCase();
    if (!q) return t.activities;
    return t.activities.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.address && a.address.toLowerCase().includes(q)) ||
      (a.notes && a.notes.toLowerCase().includes(q))
    );
  });

  public selectedDayFoodCount = computed(() =>
    this.selectedDayTimelineItems().filter(i => i.type === 'food').length
  );

  public selectedDayActivityCount = computed(() =>
    this.selectedDayTimelineItems().filter(i => i.type === 'activity').length
  );

  public countAssignedActivities = computed(() =>
    (this.trip()?.activities || []).filter(a => !!a.assignedDay).length
  );

  public countBookingRequiredActivities = computed(() =>
    (this.trip()?.activities || []).filter(a => a.bookingRequired).length
  );

  // Computed Timeline Items for Selected Day
  public selectedDayTimelineItems = computed(() => {
    const t = this.trip();
    const day = this.selectedDay();
    if (!t) return [];

    const items: TimelineItem[] = [];

    // Activities assigned to this day
    (t.activities || []).filter(a => a.assignedDay === day).forEach(a => {
      items.push({
        id: a.id,
        type: 'activity',
        name: a.name,
        timeSlot: a.timeSlot,
        address: a.address,
        notes: a.notes,
        priceInfo: a.ticketsRequired ? (a.ticketPrice ? `€${a.ticketPrice}` : 'A pagamento') : 'Gratis',
        bookingInfo: a.bookingRequired ? '⚠️ Prenotare' : undefined,
        isCompleted: a.isCompleted,
        raw: a
      });
    });

    // Places to eat assigned to this day
    (t.placesToEat || []).filter(p => p.assignedDay === day).forEach(p => {
      items.push({
        id: p.id,
        type: 'food',
        name: p.name,
        timeSlot: p.timeSlot || this.getMealDefaultTime(p.assignedMeal || p.category),
        address: p.address,
        notes: p.specialties ? `Specialità: ${p.specialties}` : p.notes,
        priceInfo: p.priceRange,
        bookingInfo: p.bookingRequired ? '⚠️ Prenotare' : undefined,
        isCompleted: p.isVisited,
        raw: p
      });
    });

    return items;
  });

  // Computed Map Stops for Selected Day
  public selectedDayMapStops = computed(() => {
    const t = this.trip();
    const day = this.selectedDay();
    if (!t) return [];

    const stops: MapStopPoint[] = [];

    // 1. Hotel if available
    if (t.accommodation && t.accommodation.coordinates) {
      stops.push({
        id: 'hotel_stop',
        name: t.accommodation.name,
        category: 'hotel',
        lat: t.accommodation.coordinates.lat,
        lng: t.accommodation.coordinates.lng,
        address: t.accommodation.address,
        timeSlot: 'Punto di partenza / Alloggio',
        details: 'Hotel e base del soggiorno'
      });
    }

    // 2. Activities on this day
    (t.activities || []).filter(a => a.assignedDay === day).forEach(a => {
      const coords = a.coordinates || this.generateFallbackCoords(t.destination, a.id);
      stops.push({
        id: a.id,
        name: a.name,
        category: 'activity',
        lat: coords.lat,
        lng: coords.lng,
        address: a.address,
        timeSlot: a.timeSlot,
        details: a.notes
      });
    });

    // 3. Places to eat on this day
    (t.placesToEat || []).filter(p => p.assignedDay === day).forEach(p => {
      const coords = p.coordinates || this.generateFallbackCoords(t.destination, p.id);
      stops.push({
        id: p.id,
        name: p.name,
        category: 'food',
        lat: coords.lat,
        lng: coords.lng,
        address: p.address,
        timeSlot: p.timeSlot || this.getMealDefaultTime(p.assignedMeal || p.category),
        details: p.specialties
      });
    });

    return stops;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadTrip(id);
      }
    });
  }

  public loadTrip(id: string): void {
    const found = this.tripService.getTripById(id);
    this.trip.set(found);
  }

  public getGroupName(groupId: string): string {
    const grp = this.groupService.getGroupById(groupId);
    return grp ? `${grp.icon} ${grp.name}` : 'Gruppo di viaggio';
  }

  public calculateDuration(start: string, end: string): string {
    if (!start || !end) return 'Da definire';
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${diff} giorni`;
  }

  public formatDateRange(start: string, end: string): string {
    if (!start) return 'Date da definire';
    const s = new Date(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} - ${e}`;
  }

  public getDayDateFormatted(dayNum: number): string {
    const t = this.trip();
    if (!t || !t.startDate) return `Giorno ${dayNum}`;
    const date = new Date(t.startDate);
    date.setDate(date.getDate() + (dayNum - 1));
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  public tripStatusIcon(status: TripStatus): string {
    return { planning: 'edit_note', upcoming: 'schedule', ongoing: 'timelapse', completed: 'check_circle' }[status] || 'luggage';
  }

  public tripStatusLabel(status: TripStatus): string {
    return {
      planning: 'In preparazione',
      upcoming: 'In arrivo',
      ongoing: 'In corso',
      completed: 'Concluso'
    }[status] || 'Pianificato';
  }

  public shareTrip(): void {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.toastService.success('Link del viaggio copiato negli appunti!');
      }).catch(() => {
        this.toastService.info('Link del viaggio: ' + url);
      });
    } else {
      this.toastService.info('Link del viaggio: ' + url);
    }
  }

  public getFoodCategoryLabel(category: FoodCategory): string {
    switch (category) {
      case 'breakfast': return 'Colazione';
      case 'lunch': return 'Pranzo';
      case 'dinner': return 'Cena';
      case 'snack': return 'Street Food';
      case 'aperitivo': return 'Aperitivo';
      default: return 'Ristorazione';
    }
  }

  public countFoodByCategory(category: FoodCategory): number {
    const t = this.trip();
    if (!t || !t.placesToEat) return 0;
    return t.placesToEat.filter(p => p.category === category).length;
  }

  public getActivityCategoryLabel(category: ActivityCategory): string {
    switch (category) {
      case 'monument': return 'Monumento';
      case 'museum': return 'Museo';
      case 'nature': return 'Natura / Parco';
      case 'experience': return 'Esperienza / Tour';
      case 'shopping': return 'Shopping / Mercato';
      default: return 'Attrazione';
    }
  }

  public getTransferIcon(option?: string): string {
    switch (option) {
      case 'metro': return 'subway';
      case 'train': return 'train';
      case 'taxi': return 'local_taxi';
      case 'uber': return 'directions_car';
      default: return 'directions_bus';
    }
  }

  public getTransferLabel(option?: string): string {
    switch (option) {
      case 'metro': return 'Metropolitana';
      case 'train': return 'Treno';
      case 'taxi': return 'Taxi';
      case 'uber': return 'Uber / Bolt';
      case 'bus': return 'Bus / Navetta';
      default: return 'Da definire';
    }
  }

  public getNavigationUrl(name: string, address?: string): string {
    const q = encodeURIComponent(`${name} ${address || ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  public getAirportCode(airportStr?: string): string {
    if (!airportStr) return 'AIR';
    const match = airportStr.match(/^[A-Z]{3}/);
    return match ? match[0] : airportStr.substring(0, 3).toUpperCase();
  }

  public formatFlightDateTime(isoStr?: string): string {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ')';
    } catch {
      return isoStr;
    }
  }

  public getHotelMapStop(): MapStopPoint[] {
    const t = this.trip();
    if (!t || !t.accommodation || !t.accommodation.coordinates) return [];
    return [{
      id: 'hotel_single',
      name: t.accommodation.name,
      category: 'hotel',
      lat: t.accommodation.coordinates.lat,
      lng: t.accommodation.coordinates.lng,
      address: t.accommodation.address,
      details: 'Alloggio del viaggio'
    }];
  }

  public getMapCenterCoordinates(): [number, number] {
    const t = this.trip();
    if (t?.accommodation?.coordinates) {
      return [t.accommodation.coordinates.lat, t.accommodation.coordinates.lng];
    }
    if (t?.destination.toLowerCase().includes('barcellona')) {
      return [41.3851, 2.1734];
    }
    if (t?.destination.toLowerCase().includes('roma')) {
      return [41.9028, 12.4964];
    }
    if (t?.destination.toLowerCase().includes('tokyo')) {
      return [35.6762, 139.6503];
    }
    return [41.3851, 2.1734];
  }

  private getMealDefaultTime(category: string): string {
    switch (category) {
      case 'breakfast': return '08:30';
      case 'lunch': return '13:00';
      case 'dinner': return '20:30';
      case 'snack': return '17:00';
      case 'aperitivo': return '19:00';
      default: return '13:00';
    }
  }

  private generateFallbackCoords(destination: string, seed: string): { lat: number; lng: number } {
    let baseLat = 41.3851;
    let baseLng = 2.1734;
    if (destination.toLowerCase().includes('roma')) {
      baseLat = 41.9028;
      baseLng = 12.4964;
    } else if (destination.toLowerCase().includes('tokyo')) {
      baseLat = 35.6762;
      baseLng = 139.6503;
    }

    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetLat = ((hash % 30) - 15) * 0.003;
    const offsetLng = (((hash * 7) % 30) - 15) * 0.003;

    return { lat: baseLat + offsetLat, lng: baseLng + offsetLng };
  }

  // Activity Actions
  public openAddActivityModal(): void {
    this.activityForm.reset({
      name: '',
      category: 'monument',
      address: '',
      ticketsRequired: false,
      ticketPrice: 0,
      bookingRequired: false,
      bookingUrl: '',
      openingHours: '',
      closingDays: '',
      notes: ''
    });
    this.isActivityModalOpen.set(true);
  }

  public saveActivity(): void {
    const t = this.trip();
    if (!t || this.activityForm.invalid) return;

    const val = this.activityForm.value;
    this.tripService.addActivity(t.id, {
      name: val.name!,
      category: val.category || 'monument',
      address: val.address || '',
      coordinates: this.generateFallbackCoords(t.destination, val.name!),
      ticketsRequired: !!val.ticketsRequired,
      ticketPrice: Number(val.ticketPrice) || 0,
      currency: 'EUR',
      bookingRequired: !!val.bookingRequired,
      bookingUrl: val.bookingUrl || '',
      openingHours: val.openingHours || '',
      closingDays: val.closingDays || '',
      notes: val.notes || '',
      assignedDay: null
    });

    this.loadTrip(t.id);
    this.isActivityModalOpen.set(false);
  }

  public deleteActivity(id: string): void {
    const t = this.trip();
    if (!t) return;
    if (confirm('Vuoi rimuovere questa attrazione?')) {
      this.tripService.deleteActivity(t.id, id);
      this.loadTrip(t.id);
    }
  }

  // Food Actions
  public openAddPlaceModal(): void {
    this.placeForm.reset({
      name: '',
      category: 'lunch',
      priceRange: '€€',
      address: '',
      specialties: '',
      openingHours: '',
      closingDays: '',
      notes: ''
    });
    this.isPlaceModalOpen.set(true);
  }

  public savePlaceToEat(): void {
    const t = this.trip();
    if (!t || this.placeForm.invalid) return;

    const val = this.placeForm.value;
    this.tripService.addPlaceToEat(t.id, {
      name: val.name!,
      category: val.category || 'lunch',
      priceRange: val.priceRange || '€€',
      address: val.address || '',
      coordinates: this.generateFallbackCoords(t.destination, val.name!),
      specialties: val.specialties || '',
      bookingRequired: false,
      openingHours: val.openingHours || '',
      closingDays: val.closingDays || '',
      notes: val.notes || '',
      assignedDay: null,
      assignedMeal: val.category || 'lunch'
    });

    this.loadTrip(t.id);
    this.isPlaceModalOpen.set(false);
  }

  public deletePlaceToEat(id: string): void {
    const t = this.trip();
    if (!t) return;
    if (confirm('Vuoi rimuovere questo locale?')) {
      this.tripService.deletePlaceToEat(t.id, id);
      this.loadTrip(t.id);
    }
  }

  // Assign to Day Actions
  public openAssignDayModal(item: TripActivity | TripPlaceToEat, type: 'activity' | 'food'): void {
    this.currentAssigningItem.set({ item, type });
    this.assignDayTarget = item.assignedDay || this.selectedDay();
    this.assignTimeSlot = item.timeSlot || '';
    this.isAssignModalOpen.set(true);
  }

  public openPlanFromBacklogModal(): void {
    this.activeTab.set('activities');
  }

  public confirmAssignDay(): void {
    const t = this.trip();
    const ctx = this.currentAssigningItem();
    if (!t || !ctx) return;

    const targetDay = Number(this.assignDayTarget) || null;

    if (ctx.type === 'activity') {
      this.tripService.updateActivity(t.id, ctx.item.id, {
        assignedDay: targetDay,
        timeSlot: this.assignTimeSlot
      });
    } else {
      this.tripService.updatePlaceToEat(t.id, ctx.item.id, {
        assignedDay: targetDay,
        timeSlot: this.assignTimeSlot
      });
    }

    this.loadTrip(t.id);
    this.isAssignModalOpen.set(false);
  }

  public unassignFromDay(item: TimelineItem): void {
    const t = this.trip();
    if (!t) return;

    if (item.type === 'activity') {
      this.tripService.updateActivity(t.id, item.id, { assignedDay: null, timeSlot: '' });
    } else {
      this.tripService.updatePlaceToEat(t.id, item.id, { assignedDay: null, timeSlot: '' });
    }

    this.loadTrip(t.id);
  }

  // Flights Actions
  public openEditFlightsModal(): void {
    const t = this.trip();
    const fl = t?.flights;
    this.flightsForm.patchValue({
      outAirline: fl?.outboundFlight?.airline || '',
      outFlightNum: fl?.outboundFlight?.flightNumber || '',
      outDepAirport: fl?.outboundFlight?.departureAirport || '',
      outDepTime: fl?.outboundFlight?.departureDateTime || '',
      outArrAirport: fl?.outboundFlight?.arrivalAirport || '',
      outArrTime: fl?.outboundFlight?.arrivalDateTime || '',
      retAirline: fl?.returnFlight?.airline || '',
      retFlightNum: fl?.returnFlight?.flightNumber || '',
      retDepAirport: fl?.returnFlight?.departureAirport || '',
      retDepTime: fl?.returnFlight?.departureDateTime || '',
      retArrAirport: fl?.returnFlight?.arrivalAirport || '',
      retArrTime: fl?.returnFlight?.arrivalDateTime || '',
      pnr: fl?.outboundFlight?.bookingReference || fl?.returnFlight?.bookingReference || ''
    });
    this.isFlightsModalOpen.set(true);
  }

  public saveFlights(): void {
    const t = this.trip();
    if (!t) return;

    const val = this.flightsForm.value;
    const flights: FlightDetails = {
      outboundFlight: {
        airline: val.outAirline || '',
        flightNumber: val.outFlightNum || '',
        departureAirport: val.outDepAirport || '',
        departureCity: val.outDepAirport?.split('-')[1]?.trim() || 'Partenza',
        departureDateTime: val.outDepTime || '',
        arrivalAirport: val.outArrAirport || '',
        arrivalCity: val.outArrAirport?.split('-')[1]?.trim() || 'Arrivo',
        arrivalDateTime: val.outArrTime || '',
        bookingReference: val.pnr || '',
        baggageNotes: '1 bagaglio a mano incluso'
      },
      returnFlight: {
        airline: val.retAirline || '',
        flightNumber: val.retFlightNum || '',
        departureAirport: val.retDepAirport || '',
        departureCity: val.retDepAirport?.split('-')[1]?.trim() || 'Partenza',
        departureDateTime: val.retDepTime || '',
        arrivalAirport: val.retArrAirport || '',
        arrivalCity: val.retArrAirport?.split('-')[1]?.trim() || 'Arrivo',
        arrivalDateTime: val.retArrTime || '',
        bookingReference: val.pnr || '',
        baggageNotes: '1 bagaglio a mano incluso'
      }
    };

    this.tripService.updateFlights(t.id, flights);
    this.loadTrip(t.id);
    this.isFlightsModalOpen.set(false);
  }

  // Transfers Actions
  public openEditTransfersModal(): void {
    const tr = this.trip()?.transfers;
    this.transfersForm.patchValue({
      recommendedOption: tr?.recommendedOption || 'bus',
      passDetails: tr?.passDetails || '',
      specialTickets: tr?.specialTickets || '',
      taxiVsUberAdvice: tr?.taxiVsUberAdvice || '',
      estimatedCost: tr?.estimatedCost || '',
      estimatedDuration: tr?.estimatedDuration || '',
      instructions: tr?.instructions || ''
    });
    this.isTransfersModalOpen.set(true);
  }

  public saveTransfers(): void {
    const t = this.trip();
    if (!t) return;

    const val = this.transfersForm.value;
    const transfers: AirportTransfer = {
      recommendedOption: val.recommendedOption || 'bus',
      passRequired: !!val.passDetails,
      passDetails: val.passDetails || '',
      specialTickets: val.specialTickets || '',
      taxiVsUberAdvice: val.taxiVsUberAdvice || '',
      estimatedCost: val.estimatedCost || '',
      estimatedDuration: val.estimatedDuration || '',
      instructions: val.instructions || ''
    };

    this.tripService.updateTransfers(t.id, transfers);
    this.loadTrip(t.id);
    this.isTransfersModalOpen.set(false);
  }

  // Accommodation Actions
  public openEditAccommodationModal(): void {
    const acc = this.trip()?.accommodation;
    this.accommodationForm.patchValue({
      name: acc?.name || '',
      address: acc?.address || '',
      checkInDate: acc?.checkInDate || this.trip()?.startDate || '',
      checkInTime: acc?.checkInTime || '14:00',
      checkOutDate: acc?.checkOutDate || this.trip()?.endDate || '',
      checkOutTime: acc?.checkOutTime || '11:00',
      bookingCode: acc?.bookingCode || '',
      phoneOrContact: acc?.phoneOrContact || '',
      notes: acc?.notes || ''
    });
    this.isAccommodationModalOpen.set(true);
  }

  public saveAccommodation(): void {
    const t = this.trip();
    if (!t || this.accommodationForm.invalid) return;

    const val = this.accommodationForm.value;
    const accommodation: AccommodationDetails = {
      name: val.name!,
      address: val.address!,
      coordinates: this.generateFallbackCoords(t.destination, val.name!),
      checkInDate: val.checkInDate || t.startDate,
      checkInTime: val.checkInTime || '14:00',
      checkOutDate: val.checkOutDate || t.endDate,
      checkOutTime: val.checkOutTime || '11:00',
      bookingCode: val.bookingCode || '',
      phoneOrContact: val.phoneOrContact || '',
      notes: val.notes || ''
    };

    this.tripService.updateAccommodation(t.id, accommodation);
    this.loadTrip(t.id);
    this.isAccommodationModalOpen.set(false);
  }

  public goToTrips(): void {
    this.router.navigate(['/trips']);
  }
}

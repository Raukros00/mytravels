import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../core/services/toast.service';
import { GroupService } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  AccommodationDetails,
  AirportTransfer,
  FlightDetails,
  FoodCategory,
  TripActivity,
  TripExpense,
  TripPlaceToEat,
  TripStatus,
  deriveTripStatus
} from '../../../core/models/trip.model';
import { MapStopPoint } from '../../../shared/components/map/interactive-map.component';
import {
  AssignDayResult,
  DetailTab,
  TimelineItem,
  buildDayTimeline,
  generateFallbackCoords,
  mealOf
} from './trip-detail.utils';
import { TripHeroComponent } from './components/trip-hero/trip-hero.component';
import { TripExpensesTabComponent } from './components/trip-expenses-tab/trip-expenses-tab.component';
import { ExpenseFormValue, TripExpenseModalComponent } from './components/trip-expense-modal/trip-expense-modal.component';
import { Transfer, buildExpenseMembers } from './components/trip-expenses-tab/trip-expenses.utils';
import { TripItineraryComponent } from './components/trip-itinerary/trip-itinerary.component';
import { TripFoodTabComponent } from './components/trip-food-tab/trip-food-tab.component';
import { TripActivitiesTabComponent } from './components/trip-activities-tab/trip-activities-tab.component';
import { LogisticsSubTab, TripLogisticsTabComponent } from './components/trip-logistics-tab/trip-logistics-tab.component';
import { NewActivityValue, TripActivityModalComponent } from './components/trip-activity-modal/trip-activity-modal.component';
import { NewPlaceValue, TripPlaceModalComponent } from './components/trip-place-modal/trip-place-modal.component';
import { AssignInitial, TripAssignModalComponent } from './components/trip-assign-modal/trip-assign-modal.component';
import { TripFlightsModalComponent } from './components/trip-flights-modal/trip-flights-modal.component';
import { TripTransfersModalComponent } from './components/trip-transfers-modal/trip-transfers-modal.component';
import {
  AccommodationFormValue,
  TripAccommodationModalComponent
} from './components/trip-accommodation-modal/trip-accommodation-modal.component';
import { todayIso } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    RouterLink,
    TripHeroComponent,
    TripExpensesTabComponent,
    TripExpenseModalComponent,
    TripItineraryComponent,
    TripFoodTabComponent,
    TripActivitiesTabComponent,
    TripLogisticsTabComponent,
    TripActivityModalComponent,
    TripPlaceModalComponent,
    TripAssignModalComponent,
    TripFlightsModalComponent,
    TripTransfersModalComponent,
    TripAccommodationModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-detail.component.html',
  styleUrl: './trip-detail.component.css'
})
export class TripDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);
  private readonly groupService = inject(GroupService);
  private readonly authService = inject(AuthService);

  private readonly tripId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') }
  );

  // Always reflects the latest state held by TripService (no manual reload after mutations).
  protected readonly trip = computed(() => {
    const id = this.tripId();
    return id ? this.tripService.getTripById(id) : undefined;
  });

  /** Coordinate della destinazione (se scelta dai suggerimenti): priorità ai luoghi vicini. */
  protected readonly destinationPoint = computed(() => {
    const t = this.trip();
    return t?.destinationLat != null && t.destinationLng != null
      ? { lat: t.destinationLat, lng: t.destinationLng }
      : null;
  });

  private readonly loadTripIfMissing = effect(() => {
    const id = this.tripId();
    if (id) this.tripService.ensureTripLoaded(id);
  });

  protected readonly activeTab = signal<DetailTab>('itinerary');
  protected readonly activeLogisticsTab = signal<LogisticsSubTab>('flights');
  protected readonly selectedDay = signal(1);
  protected readonly selectedFoodFilter = signal<FoodCategory | 'all'>('all');
  protected readonly foodSearchQuery = signal('');
  protected readonly activitySearchQuery = signal('');

  // Modal state
  protected readonly isActivityModalOpen = signal(false);
  protected readonly isPlaceModalOpen = signal(false);
  protected readonly isAssignModalOpen = signal(false);
  protected readonly isFlightsModalOpen = signal(false);
  protected readonly isTransfersModalOpen = signal(false);
  protected readonly isAccommodationModalOpen = signal(false);
  protected readonly isExpenseModalOpen = signal(false);
  protected readonly editingExpense = signal<TripExpense | null>(null);

  // Expenses: group members (+ former members still referenced by expenses)
  protected readonly currentUserId = computed(() => this.authService.currentUser()?.id);
  protected readonly expenseMembers = computed(() => {
    const t = this.trip();
    if (!t) return [];
    const members = this.groupService.getGroupById(t.groupId)?.members ?? [];
    return buildExpenseMembers(members, t.expenses ?? []);
  });
  protected readonly expensesCount = computed(() =>
    (this.trip()?.expenses ?? []).filter(e => e.type !== 'settlement').length
  );

  // Assign Day state
  private readonly currentAssigningItem = signal<{ item: TripActivity | TripPlaceToEat; type: 'activity' | 'food' } | null>(null);
  protected readonly assigningItemName = computed(() => this.currentAssigningItem()?.item.name ?? '');
  protected readonly assignInitial = computed<AssignInitial>(() => {
    const ctx = this.currentAssigningItem();
    if (!ctx) return { day: this.selectedDay() };
    const { item } = ctx;
    return {
      day: item.assignedDay || this.selectedDay(),
      startTime: item.startTime,
      endTime: item.endTime,
      timeSlot: item.timeSlot,
      meal: ctx.type === 'food' ? mealOf(item as TripPlaceToEat) : null
    };
  });

  // Days [1, 2, 3, ...]
  protected readonly tripDaysNumbers = computed(() => {
    const t = this.trip();
    if (!t || !t.startDate || !t.endDate) return [1, 2, 3];
    const s = new Date(t.startDate);
    const e = new Date(t.endDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const count = Math.max(1, Math.min(diff, 30));
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  protected readonly currentTripStatus = computed<TripStatus>(() => {
    const t = this.trip();
    return t ? deriveTripStatus(t) : 'planning';
  });

  /** Tappe del giorno in sequenza: ordine scelto, poi orari (pranzo e cena con l'orario indicativo). */
  protected readonly selectedDayTimelineItems = computed(() => {
    const t = this.trip();
    if (!t) return [];
    return buildDayTimeline(t.activities || [], t.placesToEat || [], this.selectedDay());
  });

  protected readonly selectedDayFoodCount = computed(() =>
    this.selectedDayTimelineItems().filter(i => i.type === 'food').length
  );

  protected readonly selectedDayActivityCount = computed(() =>
    this.selectedDayTimelineItems().filter(i => i.type === 'activity').length
  );

  protected readonly selectedDayMapStops = computed(() => {
    const t = this.trip();
    if (!t) return [];

    const stops: MapStopPoint[] = [];

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

    // Nello stesso ordine dell'itinerario: la linea sulla mappa segue la sequenza della giornata.
    for (const item of this.selectedDayTimelineItems()) {
      const coords = item.raw.coordinates || generateFallbackCoords(t.destination, item.id);
      stops.push({
        id: item.id,
        name: item.name,
        category: item.type,
        lat: coords.lat,
        lng: coords.lng,
        address: item.address,
        timeSlot: item.timeLabel,
        details: item.type === 'food' ? (item.raw as TripPlaceToEat).specialties : item.raw.notes
      });
    }

    return stops;
  });

  protected readonly mapCenter = computed<[number, number]>(() => {
    const t = this.trip();
    if (t?.accommodation?.coordinates) {
      return [t.accommodation.coordinates.lat, t.accommodation.coordinates.lng];
    }
    if (t?.destinationLat != null && t?.destinationLng != null) {
      return [t.destinationLat, t.destinationLng];
    }
    const dest = t?.destination.toLowerCase() ?? '';
    if (dest.includes('roma')) return [41.9028, 12.4964];
    if (dest.includes('tokyo')) return [35.6762, 139.6503];
    return [41.3851, 2.1734];
  });

  protected shareTrip(): void {
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

  protected goToTrips(): void {
    this.router.navigate(['/trips']);
  }

  // Activity actions
  protected saveActivity(val: NewActivityValue): void {
    const t = this.trip();
    if (!t) return;
    // Solo coordinate vere (da un luogo suggerito): senza, la mappa usa una posizione approssimata.
    this.tripService.addActivity(t.id, {
      ...val,
      assignedDay: null
    });
    this.isActivityModalOpen.set(false);
  }

  protected deleteActivity(id: string): void {
    const t = this.trip();
    if (t && confirm('Vuoi rimuovere questa attrazione?')) {
      this.tripService.deleteActivity(t.id, id);
    }
  }

  // Food actions
  protected savePlaceToEat(val: NewPlaceValue): void {
    const t = this.trip();
    if (!t) return;
    this.tripService.addPlaceToEat(t.id, {
      ...val,
      coordinates: generateFallbackCoords(t.destination, val.name),
      assignedDay: null
    });
    this.isPlaceModalOpen.set(false);
  }

  protected deletePlaceToEat(id: string): void {
    const t = this.trip();
    if (t && confirm('Vuoi rimuovere questo locale?')) {
      this.tripService.deletePlaceToEat(t.id, id);
    }
  }

  // Assign to day actions
  protected openAssignDayModal(item: TripActivity | TripPlaceToEat, type: 'activity' | 'food'): void {
    this.currentAssigningItem.set({ item, type });
    this.isAssignModalOpen.set(true);
  }

  protected openPlanFromBacklogModal(): void {
    this.activeTab.set('activities');
  }

  protected confirmAssignDay(result: AssignDayResult): void {
    const t = this.trip();
    const ctx = this.currentAssigningItem();
    if (!t || !ctx) return;

    const { item } = ctx;
    const moved = result.day !== (item.assignedDay ?? null)
      || result.startTime !== (item.startTime ?? null)
      || result.endTime !== (item.endTime ?? null);
    const changes = {
      assignedDay: result.day,
      startTime: result.startTime,
      endTime: result.endTime,
      timeSlot: result.timeSlot,
      // Cambiati giorno od orari: la tappa si reinserisce nella giornata in base all'orario.
      dayOrder: moved ? null : item.dayOrder ?? null
    };
    if (ctx.type === 'activity') {
      this.tripService.updateActivity(t.id, ctx.item.id, changes);
    } else {
      this.tripService.updatePlaceToEat(t.id, ctx.item.id, changes);
    }
    this.isAssignModalOpen.set(false);
  }

  protected unassignFromDay(item: TimelineItem): void {
    const t = this.trip();
    if (!t) return;

    const changes = { assignedDay: null, timeSlot: '', startTime: null, endTime: null, dayOrder: null };
    if (item.type === 'activity') {
      this.tripService.updateActivity(t.id, item.id, changes);
    } else {
      this.tripService.updatePlaceToEat(t.id, item.id, changes);
    }
  }

  /** Modifica dell'orario dall'itinerario: stessa modale della pianificazione. */
  protected editStopTime(item: TimelineItem): void {
    this.openAssignDayModal(item.raw, item.type);
  }

  /** Nuova sequenza della giornata (frecce o trascinamento): salvata in una volta. */
  protected reorderDay(items: TimelineItem[]): void {
    const t = this.trip();
    if (!t) return;
    this.tripService.reorderDayStops(t.id, this.selectedDay(), items.map(i => ({ type: i.type, id: i.id })));
  }

  // Logistics actions
  protected saveFlights(flights: FlightDetails): void {
    const t = this.trip();
    if (!t) return;
    this.tripService.updateFlights(t.id, flights);
    this.isFlightsModalOpen.set(false);
  }

  protected saveTransfers(transfers: AirportTransfer): void {
    const t = this.trip();
    if (!t) return;
    this.tripService.updateTransfers(t.id, transfers);
    this.isTransfersModalOpen.set(false);
  }

  protected saveAccommodation(val: AccommodationFormValue): void {
    const t = this.trip();
    if (!t) return;
    const accommodation: AccommodationDetails = {
      ...val,
      coordinates: generateFallbackCoords(t.destination, val.name)
    };
    this.tripService.updateAccommodation(t.id, accommodation);
    this.isAccommodationModalOpen.set(false);
  }

  // Expense actions
  protected openExpenseModal(expense: TripExpense | null = null): void {
    this.editingExpense.set(expense);
    this.isExpenseModalOpen.set(true);
  }

  protected saveExpense(val: ExpenseFormValue): void {
    const t = this.trip();
    if (!t) return;
    const editing = this.editingExpense();
    if (editing) {
      this.tripService.updateExpense(t.id, editing.id, val);
    } else {
      this.tripService.addExpense(t.id, val);
    }
    this.isExpenseModalOpen.set(false);
  }

  protected deleteExpense(id: string): void {
    const t = this.trip();
    if (t) this.tripService.deleteExpense(t.id, id);
  }

  protected settleTransfer(transfer: Transfer): void {
    const t = this.trip();
    if (!t) return;
    this.tripService.addExpense(t.id, {
      title: 'Pagamento',
      amount: transfer.amount,
      category: 'other',
      date: todayIso(),
      paidBy: transfer.from,
      splitAmong: [transfer.to],
      shares: { [transfer.to]: transfer.amount },
      type: 'settlement'
    });
  }
}

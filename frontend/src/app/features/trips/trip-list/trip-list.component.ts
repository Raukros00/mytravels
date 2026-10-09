import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../core/services/trip.service';
import { GroupService } from '../../../core/services/group.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Trip, TripStatus, deriveTripStatus, isProposal } from '../../../core/models/trip.model';

interface StatusMeta { label: string; icon: string; cls: string; }

const STATUS_META: Record<TripStatus, StatusMeta> = {
  ongoing: { label: 'In corso', icon: 'timelapse', cls: 'badge-emerald' },
  upcoming: { label: 'In arrivo', icon: 'schedule', cls: 'badge-indigo' },
  planning: { label: 'Pianificazione', icon: 'edit_calendar', cls: 'badge-amber' },
  completed: { label: 'Completato', icon: 'check_circle', cls: 'badge-slate' }
};

const FILTERS: { value: TripStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'ongoing', label: 'In corso' },
  { value: 'upcoming', label: 'In arrivo' },
  { value: 'planning', label: 'Pianificazione' },
  { value: 'completed', label: 'Passati' }
];

interface TripCardVm {
  trip: Trip;
  status: StatusMeta;
  location: string;
  dates: string;
  duration: string;
  budget: string | null;
  tags: string[];
  groupName: string;
}

interface CurrentTripVm {
  trip: Trip;
  status: StatusMeta;
  location: string;
  dates: string;
  groupName: string;
  /** Live progress ("Giorno 2 di 5") or countdown ("Parte tra 12 giorni"). */
  progress: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'openMenuId.set(null)' },
  selector: 'app-trip-list',
  imports: [RouterModule, FormsModule, EmptyStateComponent],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.css'
})
export class TripListComponent {
  private router = inject(Router);
  public tripService = inject(TripService);
  public groupService = inject(GroupService);

  public searchQuery = signal('');
  public selectedStatus = signal<TripStatus | 'all'>('all');
  public openMenuId = signal<string | null>(null);

  constructor() {
    // Trips are loaded per group: make sure every group of the user is fetched, not just the active one
    effect(() => {
      for (const group of this.groupService.userGroups()) {
        this.tripService.loadTripsByGroup(group.id);
      }
    });
  }

  /** Confirmed trips of every (non-archived) group of the user, newest start date first. */
  protected readonly allTrips = computed(() => {
    const groupIds = new Set(this.groupService.userGroups().map(g => g.id));
    return this.tripService.trips()
      .filter(t => groupIds.has(t.groupId) && !isProposal(t))
      .map(t => ({ ...t, status: deriveTripStatus(t) }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  });

  private readonly groupNames = computed(() =>
    new Map(this.groupService.userGroups().map(g => [g.id, g.name]))
  );

  protected readonly groupsCount = computed(() => new Set(this.allTrips().map(t => t.groupId)).size);

  /** The trip happening now, otherwise the next one to start. */
  protected readonly currentTrip = computed<CurrentTripVm | null>(() => {
    const trips = this.allTrips();
    const trip = trips.find(t => t.status === 'ongoing')
      ?? trips.filter(t => t.status === 'upcoming').sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    if (!trip) return null;
    return {
      trip,
      status: STATUS_META[trip.status],
      location: trip.country ? `${trip.destination}, ${trip.country}` : trip.destination,
      dates: this.formatDateRange(trip.startDate, trip.endDate),
      groupName: this.groupNames().get(trip.groupId) ?? '',
      progress: this.progressLabel(trip)
    };
  });

  public readonly filters = computed(() => {
    const list = this.allTrips();
    return FILTERS
      .map(f => ({
        ...f,
        count: f.value === 'all' ? list.length : list.filter(t => t.status === f.value).length
      }))
      .filter(f => f.value === 'all' || f.count > 0 || this.selectedStatus() === f.value);
  });

  public filteredTrips = computed<TripCardVm[]>(() => {
    const list = this.allTrips();
    const query = this.searchQuery().toLowerCase().trim();
    const status = this.selectedStatus();

    return list
      .filter(trip => {
        const matchesSearch = !query ||
          trip.title.toLowerCase().includes(query) ||
          trip.destination.toLowerCase().includes(query) ||
          trip.country.toLowerCase().includes(query) ||
          trip.tags.some(t => t.toLowerCase().includes(query));
        const matchesStatus = status === 'all' || trip.status === status;
        return matchesSearch && matchesStatus;
      })
      .map(trip => ({
        trip,
        status: STATUS_META[trip.status],
        location: trip.country ? `${trip.destination}, ${trip.country}` : trip.destination,
        dates: this.formatDateRange(trip.startDate, trip.endDate),
        duration: this.calculateDuration(trip.startDate, trip.endDate),
        budget: trip.budgetEstimate ? `${trip.budgetEstimate} ${trip.currency || 'EUR'}` : null,
        tags: trip.tags.slice(0, 3),
        groupName: this.groupNames().get(trip.groupId) ?? ''
      }));
  });

  private progressLabel(trip: Trip): string {
    const dayMs = 1000 * 60 * 60 * 24;
    const today = new Date(new Date().toISOString().split('T')[0]).getTime();
    const start = new Date(trip.startDate).getTime();
    const end = new Date(trip.endDate).getTime();
    if (trip.status === 'ongoing') {
      const day = Math.floor((today - start) / dayMs) + 1;
      const total = Math.round((end - start) / dayMs) + 1;
      return `Giorno ${day} di ${total}`;
    }
    const days = Math.ceil((start - today) / dayMs);
    return days <= 1 ? 'Parte domani' : `Parte tra ${days} giorni`;
  }

  private calculateDuration(start: string, end: string): string {
    if (!start || !end) return 'Da definire';
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'}`;
  }

  private formatDateRange(start: string, end: string): string {
    if (!start) return 'Date non specificate';
    const s = new Date(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} - ${e}`;
  }

  toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.update(cur => (cur === id ? null : id));
  }

  deleteTrip(id: string, title: string, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    if (confirm(`Sei sicuro di voler eliminare il viaggio "${title}"?`)) {
      this.tripService.deleteTrip(id);
    }
  }

  goToNewTrip(): void {
    this.router.navigate(['/trips/new']);
  }
}

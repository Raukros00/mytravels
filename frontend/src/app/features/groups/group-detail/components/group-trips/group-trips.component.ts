import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Trip, TripStatus, deriveTripStatus } from '../../../../../core/models/trip.model';
import { GroupMember } from '../../../../../core/models/group.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { TripService } from '../../../../../core/services/trip.service';

const DAY_MS = 86400000;
const STATUS_ICONS: Record<TripStatus, string> = {
  planning: 'edit_note', upcoming: 'schedule', ongoing: 'timelapse', completed: 'check_circle'
};

const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);

const tripDays = (trip: Trip): number => daysBetween(trip.startDate, trip.endDate) + 1;

@Component({
  selector: 'app-group-trips',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-trips.component.html',
  styleUrl: './group-trips.component.css'
})
export class GroupTripsComponent {
  private readonly router = inject(Router);
  private readonly tripService = inject(TripService);
  private readonly authService = inject(AuthService);

  readonly groupId = input.required<string>();
  readonly members = input<GroupMember[]>([]);
  /** Confirmed trips, already sorted. */
  readonly trips = input<Trip[]>([]);
  readonly proposals = input<Trip[]>([]);

  private readonly previewCount = 3;
  private readonly pageSize = 4;
  readonly expanded = signal(false);
  private readonly loaded = signal(this.previewCount);

  readonly visibleTrips = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return this.trips()
      .slice(0, this.expanded() ? this.loaded() : this.previewCount)
      .map(trip => {
        const status = deriveTripStatus(trip);
        const total = tripDays(trip);
        return { trip, status, icon: STATUS_ICONS[status], days: total, note: this.statusNote(trip, status, today, total) };
      });
  });

  readonly canExpand = computed(() => this.trips().length > this.previewCount);
  readonly hasMore = computed(() => this.expanded() && this.loaded() < this.trips().length);

  readonly proposalCards = computed(() => {
    const me = this.authService.currentUser();
    return this.proposals().map(trip => {
      const validVotes = this.tripService.validVotes(trip);
      const needed = this.tripService.votesNeeded(trip);
      return {
        trip,
        days: tripDays(trip),
        proposer: this.members().find(m => m.id === trip.proposedBy)?.name ?? '',
        votes: validVotes.length,
        needed,
        hasVoted: !!me && validVotes.includes(me.id)
      };
    });
  });

  /** Extra line shown on the card depending on the trip status. */
  private statusNote(trip: Trip, status: TripStatus, today: string, total: number):
    { key: string; params: Record<string, number>; progress?: number } {
    switch (status) {
      case 'ongoing': {
        const day = daysBetween(trip.startDate, today) + 1;
        return { key: 'groups.trip_note_ongoing', params: { day, total }, progress: (day / total) * 100 };
      }
      case 'completed':
        return { key: 'groups.trip_note_completed', params: { days: daysBetween(trip.endDate, today) } };
      default: {
        const days = daysBetween(today, trip.startDate);
        return { key: days === 1 ? 'groups.trip_note_tomorrow' : 'groups.trip_note_upcoming', params: { days } };
      }
    }
  }

  expand(): void {
    this.loaded.set(this.previewCount + this.pageSize);
    this.expanded.set(true);
  }

  collapse(scroller: HTMLElement): void {
    this.expanded.set(false);
    scroller.scrollTop = 0;
  }

  /** Infinite scroll: load the next page when the user nears the bottom of the list. */
  onScroll(event: Event): void {
    if (!this.hasMore()) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      this.loaded.update(n => n + this.pageSize);
    }
  }

  toggleVote(trip: Trip): void {
    this.tripService.toggleVote(trip.id);
  }

  createTrip(): void {
    this.router.navigate(['/trips', 'new'], { queryParams: { groupId: this.groupId() } });
  }
}

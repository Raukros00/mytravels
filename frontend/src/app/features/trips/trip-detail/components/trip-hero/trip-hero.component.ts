import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Trip, TripStatus } from '../../../../../core/models/trip.model';

@Component({
  selector: 'app-trip-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-hero.component.html',
  styleUrl: './trip-hero.component.css'
})
export class TripHeroComponent {
  readonly trip = input.required<Trip>();
  readonly status = input.required<TripStatus>();

  readonly share = output<void>();

  protected readonly statusIcon = computed(() => {
    switch (this.status()) {
      case 'ongoing': return 'flight_takeoff';
      case 'upcoming': return 'event_available';
      case 'completed': return 'check_circle';
      default: return 'edit_calendar';
    }
  });

  protected readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'ongoing': return 'In corso';
      case 'upcoming': return 'In arrivo';
      case 'completed': return 'Completato';
      default: return 'In pianificazione';
    }
  });

  protected readonly duration = computed(() => {
    const { startDate, endDate } = this.trip();
    if (!startDate || !endDate) return '';
    const diff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff} ${diff === 1 ? 'giorno' : 'giorni'}` : '';
  });

  protected readonly dateRange = computed(() => {
    const { startDate, endDate } = this.trip();
    if (!startDate) return 'Date non definite';
    const s = new Date(startDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    if (!endDate) return s;
    const e = new Date(endDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  });
}

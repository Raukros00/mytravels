import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Trip, TripStatus } from '../../../../../core/models/trip.model';

@Component({
  selector: 'app-trip-hero',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './trip-hero.component.html',
  styleUrl: './trip-hero.component.css'
})
export class TripHeroComponent {
  @Input({ required: true }) trip!: Trip;
  @Input({ required: true }) status: TripStatus = 'planning';
  @Input() groupName: string | null = null;

  @Output() share = new EventEmitter<void>();

  public showMobileDetails = signal<boolean>(false);

  public toggleMobileDetails(): void {
    this.showMobileDetails.update(v => !v);
  }

  public get statusIcon(): string {
    switch (this.status) {
      case 'ongoing': return 'flight_takeoff';
      case 'upcoming': return 'event_available';
      case 'completed': return 'check_circle';
      default: return 'edit_calendar';
    }
  }

  public get statusLabel(): string {
    switch (this.status) {
      case 'ongoing': return 'In corso';
      case 'upcoming': return 'In arrivo';
      case 'completed': return 'Completato';
      default: return 'In pianificazione';
    }
  }

  public formatDateRange(start?: string, end?: string): string {
    if (!start) return 'Date non definite';
    const s = new Date(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }

  public calculateDuration(start?: string, end?: string): string {
    if (!start || !end) return '';
    const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? `${diff} ${diff === 1 ? 'giorno' : 'giorni'}` : '';
  }
}

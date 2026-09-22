import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TripService } from '../../../core/services/trip.service';
import { GroupService } from '../../../core/services/group.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { Trip, TripStatus } from '../../../core/models/trip.model';

@Component({
  selector: 'app-trip-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, EmptyStateComponent],
  templateUrl: './trip-list.component.html',
  styleUrl: './trip-list.component.css'
})
export class TripListComponent {
  private router = inject(Router);
  public tripService = inject(TripService);
  public groupService = inject(GroupService);

  public searchQuery = '';
  public selectedStatus = signal<TripStatus | 'all'>('all');

  public filteredTrips = computed(() => {
    const list = this.tripService.activeGroupTrips();
    const query = this.searchQuery.toLowerCase().trim();
    const status = this.selectedStatus();

    return list.filter(trip => {
      const matchesSearch = !query || 
        trip.title.toLowerCase().includes(query) ||
        trip.destination.toLowerCase().includes(query) ||
        trip.country.toLowerCase().includes(query) ||
        trip.tags.some(t => t.toLowerCase().includes(query));

      const matchesStatus = status === 'all' || trip.status === status;

      return matchesSearch && matchesStatus;
    });
  });

  calculateDuration(start: string, end: string): string {
    if (!start || !end) return 'Da definire';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} ${diffDays === 1 ? 'giorno' : 'giorni'}`;
  }

  formatDateRange(start: string, end: string): string {
    if (!start) return 'Date non specificate';
    const s = new Date(start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    if (!end) return s;
    const e = new Date(end).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} - ${e}`;
  }

  deleteTrip(id: string, title: string, event: MouseEvent): void {
    event.stopPropagation();
    if (confirm(`Sei sicuro di voler eliminare il viaggio "${title}"?`)) {
      this.tripService.deleteTrip(id);
    }
  }

  goToNewTrip(): void {
    this.router.navigate(['/trips/new']);
  }
}

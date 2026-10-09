import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimelineItem } from '../../trip-detail.component';
import { InteractiveMapComponent, MapStopPoint } from '../../../../../shared/components/map/interactive-map.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-trip-itinerary',
  standalone: true,
  imports: [CommonModule, InteractiveMapComponent, EmptyStateComponent],
  templateUrl: './trip-itinerary.component.html',
  styleUrl: './trip-itinerary.component.css'
})
export class TripItineraryComponent {
  @Input({ required: true }) tripDays: number[] = [1];
  @Input({ required: true }) selectedDay: number = 1;
  @Input({ required: true }) timelineItems: TimelineItem[] = [];
  @Input({ required: true }) mapStops: MapStopPoint[] = [];
  @Input({ required: true }) mapCenter: [number, number] = [41.9028, 12.4964];
  @Input() dayFoodCount: number = 0;
  @Input() dayActivityCount: number = 0;
  @Input() startDate?: string;

  @Output() daySelected = new EventEmitter<number>();
  @Output() addStep = new EventEmitter<void>();
  @Output() unassignItem = new EventEmitter<TimelineItem>();

  public getDayDateFormatted(dayNum: number): string {
    if (!this.startDate) return `Giorno ${dayNum}`;
    const date = new Date(this.startDate);
    date.setDate(date.getDate() + (dayNum - 1));
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  public getNavigationUrl(name: string, address?: string): string {
    const query = encodeURIComponent(`${name} ${address || ''}`.trim());
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
}

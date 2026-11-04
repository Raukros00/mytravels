import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TimelineItem, formatDayDate, getNavigationUrl } from '../../trip-detail.utils';
import { InteractiveMapComponent, MapStopPoint } from '../../../../../shared/components/map/interactive-map.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-trip-itinerary',
  standalone: true,
  imports: [InteractiveMapComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-itinerary.component.html',
  styleUrl: './trip-itinerary.component.css'
})
export class TripItineraryComponent {
  readonly tripDays = input.required<number[]>();
  readonly selectedDay = input.required<number>();
  readonly timelineItems = input.required<TimelineItem[]>();
  readonly mapStops = input.required<MapStopPoint[]>();
  readonly mapCenter = input.required<[number, number]>();
  readonly dayFoodCount = input(0);
  readonly dayActivityCount = input(0);
  readonly startDate = input<string | undefined>();

  readonly daySelected = output<number>();
  readonly addStep = output<void>();
  readonly unassignItem = output<TimelineItem>();

  protected dayDate(dayNum: number): string {
    return formatDayDate(this.startDate(), dayNum);
  }

  protected navUrl(name: string, address?: string): string {
    return getNavigationUrl(name, address);
  }
}

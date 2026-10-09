import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { Trip } from '../../../../../core/models/trip.model';
import { InteractiveMapComponent, MapStopPoint } from '../../../../../shared/components/map/interactive-map.component';
import { getNavigationUrl } from '../../trip-detail.utils';
import { TripFlightCardComponent } from '../trip-flight-card/trip-flight-card.component';

export type LogisticsSubTab = 'flights' | 'hotel' | 'transfers';

@Component({
  selector: 'app-trip-logistics-tab',
  standalone: true,
  imports: [InteractiveMapComponent, TripFlightCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-logistics-tab.component.html',
  styleUrls: ['../shared/tab-common.css', './trip-logistics-tab.component.css']
})
export class TripLogisticsTabComponent {
  readonly trip = input.required<Trip>();
  readonly subTab = model<LogisticsSubTab>('flights');

  readonly editFlights = output<void>();
  readonly editHotel = output<void>();
  readonly editTransfers = output<void>();

  protected readonly hotelCoords = computed(() => this.trip().accommodation?.coordinates);

  protected readonly hotelCenter = computed<[number, number]>(() => {
    const c = this.hotelCoords();
    return c ? [c.lat, c.lng] : [41.3851, 2.1734];
  });

  protected readonly hotelMapStops = computed<MapStopPoint[]>(() => {
    const acc = this.trip().accommodation;
    if (!acc || !acc.coordinates) return [];
    return [{
      id: 'hotel_single',
      name: acc.name,
      category: 'hotel',
      lat: acc.coordinates.lat,
      lng: acc.coordinates.lng,
      address: acc.address,
      details: 'Alloggio del viaggio'
    }];
  });

  protected readonly hotelNavUrl = computed(() => {
    const acc = this.trip().accommodation;
    return getNavigationUrl(acc?.name || '', acc?.address || '');
  });

  protected transferIcon(option?: string): string {
    switch (option) {
      case 'metro': return 'subway';
      case 'train': return 'train';
      case 'taxi': return 'local_taxi';
      case 'uber': return 'directions_car';
      default: return 'directions_bus';
    }
  }

  protected transferLabel(option?: string): string {
    switch (option) {
      case 'metro': return 'Metropolitana';
      case 'train': return 'Treno';
      case 'taxi': return 'Taxi';
      case 'uber': return 'Uber / Bolt';
      case 'bus': return 'Bus / Navetta';
      default: return 'Da definire';
    }
  }
}

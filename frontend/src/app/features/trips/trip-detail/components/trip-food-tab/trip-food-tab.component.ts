import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FoodCategory, GeoPoint, TripActivity, TripPlaceToEat } from '../../../../../core/models/trip.model';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { InteractiveMapComponent, MapStopPoint } from '../../../../../shared/components/map/interactive-map.component';
import { getNavigationUrl } from '../../trip-detail.utils';

/** Activities within this distance of the selected place are shown as "nearby". */
const NEARBY_RADIUS_METERS = 1500;

interface NearbyActivity {
  activity: TripActivity;
  meters: number;
}

function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

@Component({
  selector: 'app-trip-food-tab',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent, InteractiveMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-food-tab.component.html',
  styleUrls: ['../shared/tab-common.css', '../shared/item-feed.css', './trip-food-tab.component.css']
})
export class TripFoodTabComponent {
  readonly places = input<TripPlaceToEat[] | undefined>();
  readonly activities = input<TripActivity[] | undefined>();
  readonly mapCenter = input<[number, number]>([41.3851, 2.1734]);

  private readonly selectedId = signal<string | null>(null);

  readonly searchQuery = model('');
  readonly filter = model<FoodCategory | 'all'>('all');

  readonly addPlace = output<void>();
  readonly assignPlace = output<TripPlaceToEat>();
  readonly deletePlace = output<string>();

  protected readonly filters: { value: FoodCategory | 'all'; label: string }[] = [
    { value: 'breakfast', label: 'Colazione' },
    { value: 'lunch', label: 'Pranzo' },
    { value: 'dinner', label: 'Cena' },
    { value: 'aperitivo', label: 'Aperitivo' },
    { value: 'snack', label: 'Street Food' }
  ];

  protected readonly totalCount = computed(() => this.places()?.length ?? 0);

  protected readonly filteredPlaces = computed(() => {
    let list = this.places() ?? [];
    const filter = this.filter();
    if (filter !== 'all') {
      list = list.filter(p => p.category === filter);
    }
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.specialties && p.specialties.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q))
      );
    }
    return list;
  });

  /** Place shown on the map: the clicked one, falling back to the first visible. */
  protected readonly selectedPlace = computed<TripPlaceToEat | null>(() => {
    const list = this.filteredPlaces();
    return list.find(p => p.id === this.selectedId()) ?? list[0] ?? null;
  });

  protected readonly nearbyActivities = computed<NearbyActivity[]>(() => {
    const origin = this.selectedPlace()?.coordinates;
    if (!origin) return [];
    return (this.activities() ?? [])
      .filter(a => a.coordinates)
      .map(activity => ({ activity, meters: distanceMeters(origin, activity.coordinates!) }))
      .filter(n => n.meters <= NEARBY_RADIUS_METERS)
      .sort((a, b) => a.meters - b.meters);
  });

  protected readonly mapStops = computed<MapStopPoint[]>(() => {
    const place = this.selectedPlace();
    if (!place?.coordinates) return [];
    const stops: MapStopPoint[] = [{
      id: place.id,
      name: place.name,
      category: 'food',
      lat: place.coordinates.lat,
      lng: place.coordinates.lng,
      address: place.address,
      details: place.specialties
    }];
    for (const { activity, meters } of this.nearbyActivities()) {
      stops.push({
        id: activity.id,
        name: activity.name,
        category: 'activity',
        lat: activity.coordinates!.lat,
        lng: activity.coordinates!.lng,
        address: activity.address,
        details: this.formatDistance(meters)
      });
    }
    return stops;
  });

  protected readonly nearbyRadiusLabel = `${NEARBY_RADIUS_METERS / 1000} km`;

  protected selectPlace(id: string): void {
    this.selectedId.set(id);
  }

  protected formatDistance(meters: number): string {
    return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
  }

  protected categoryLabel(category: FoodCategory): string {
    switch (category) {
      case 'breakfast': return 'Colazione';
      case 'lunch': return 'Pranzo';
      case 'dinner': return 'Cena';
      case 'snack': return 'Street Food';
      case 'aperitivo': return 'Aperitivo';
      default: return 'Ristorazione';
    }
  }

  protected navUrl(name: string, address?: string): string {
    return getNavigationUrl(name, address);
  }
}

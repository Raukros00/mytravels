import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivityCategory, TripActivity } from '../../../../../core/models/trip.model';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { getNavigationUrl } from '../../trip-detail.utils';

@Component({
  selector: 'app-trip-activities-tab',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-activities-tab.component.html',
  styleUrls: ['../shared/tab-common.css', '../shared/item-feed.css', './trip-activities-tab.component.css']
})
export class TripActivitiesTabComponent {
  readonly activities = input<TripActivity[] | undefined>();

  readonly searchQuery = model('');

  readonly addActivity = output<void>();
  readonly assignActivity = output<TripActivity>();
  readonly deleteActivity = output<string>();

  protected readonly totalCount = computed(() => this.activities()?.length ?? 0);

  protected readonly filteredActivities = computed(() => {
    const list = this.activities() ?? [];
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return list;
    return list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.address && a.address.toLowerCase().includes(q)) ||
      (a.notes && a.notes.toLowerCase().includes(q))
    );
  });

  protected categoryLabel(category: ActivityCategory): string {
    switch (category) {
      case 'monument': return 'Monumento';
      case 'museum': return 'Museo';
      case 'nature': return 'Natura / Parco';
      case 'experience': return 'Esperienza / Tour';
      case 'shopping': return 'Shopping / Mercato';
      default: return 'Attrazione';
    }
  }

  protected navUrl(name: string, address?: string): string {
    return getNavigationUrl(name, address);
  }
}

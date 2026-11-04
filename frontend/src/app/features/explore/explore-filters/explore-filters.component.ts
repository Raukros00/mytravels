import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DurationBucket, ExploreFilters, ExploreSort } from '../../../core/models/trip-template.model';

@Component({
  selector: 'app-explore-filters',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore-filters.component.html',
  styleUrl: './explore-filters.component.css'
})
export class ExploreFiltersComponent {
  readonly filters = input.required<ExploreFilters>();
  readonly tags = input<string[]>([]);
  readonly hasActive = input(false);

  readonly textChange = output<string>();
  readonly tagToggle = output<string>();
  readonly durationChange = output<DurationBucket>();
  readonly budgetChange = output<number>();
  readonly sortChange = output<ExploreSort>();
  readonly reset = output<void>();

  protected readonly durations: { value: DurationBucket; label: string }[] = [
    { value: 'all', label: 'Qualsiasi durata' },
    { value: 'short', label: 'Weekend (1-3 giorni)' },
    { value: 'medium', label: 'Settimana corta (4-5 giorni)' },
    { value: 'long', label: 'Viaggio lungo (6+ giorni)' }
  ];

  protected readonly budgets: { value: number; label: string }[] = [
    { value: 0, label: 'Qualsiasi budget' },
    { value: 500, label: 'Fino a €500' },
    { value: 1000, label: 'Fino a €1.000' },
    { value: 1500, label: 'Fino a €1.500' },
    { value: 2000, label: 'Fino a €2.000' }
  ];

  protected readonly sorts: { value: ExploreSort; label: string }[] = [
    { value: 'popular', label: 'Più popolari' },
    { value: 'rating', label: 'Meglio valutati' },
    { value: 'budget', label: 'Budget crescente' }
  ];
}

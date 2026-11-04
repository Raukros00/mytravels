import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripTemplate } from '../../../core/models/trip-template.model';
import { daysLabel, formatBudget, formatRating } from '../explore.utils';

@Component({
  selector: 'app-explore-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore-card.component.html',
  styleUrl: './explore-card.component.css'
})
export class ExploreCardComponent {
  readonly template = input.required<TripTemplate>();
  readonly isTop = input(false);

  protected readonly daysLabel = daysLabel;
  protected readonly formatBudget = formatBudget;
  protected readonly formatRating = formatRating;
}

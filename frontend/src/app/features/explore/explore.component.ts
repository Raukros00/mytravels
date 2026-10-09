import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ExploreService } from '../../core/services/explore.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ExploreCardComponent } from './explore-card/explore-card.component';
import { ExploreHeroCarouselComponent } from './explore-hero-carousel/explore-hero-carousel.component';
import { ExploreRailComponent } from './explore-rail/explore-rail.component';
import { ExploreFiltersComponent } from './explore-filters/explore-filters.component';

@Component({
  selector: 'app-explore',
  imports: [ExploreHeroCarouselComponent, ExploreRailComponent, ExploreCardComponent, ExploreFiltersComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.css'
})
export class ExploreComponent {
  protected readonly explore = inject(ExploreService);

  /** "Mostra tutto" switches from the curated rails to the full grid. */
  protected readonly showAll = signal(false);

  /** Rails are the landing view: only when nothing has been searched or filtered. */
  protected readonly showRails = computed(() => !this.explore.hasActiveFilters() && !this.showAll());

  protected readonly rails = computed(() => {
    const all = this.explore.templates();
    const byTag = (tag: string) => all.filter(t => t.tags.includes(tag));
    return [
      {
        title: 'Più scelto',
        icon: 'workspace_premium',
        templates: [...all].sort((a, b) => b.usesCount - a.usesCount).slice(0, 6)
      },
      { title: 'Città', icon: 'location_city', templates: byTag('Città') },
      { title: 'Avventura', icon: 'hiking', templates: byTag('Avventura') }
    ].filter(r => r.templates.length > 0);
  });
}

import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';
import { TripTemplate } from '../../../core/models/trip-template.model';
import { ExploreCardComponent } from '../explore-card/explore-card.component';

/** Horizontally scrolling row of template cards (Airbnb-style rail). */
@Component({
  selector: 'app-explore-rail',
  imports: [ExploreCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore-rail.component.html',
  styleUrl: './explore-rail.component.css'
})
export class ExploreRailComponent {
  readonly title = input.required<string>();
  readonly icon = input('');
  readonly templates = input.required<TripTemplate[]>();
  readonly topIds = input<Set<string>>(new Set());

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected scroll(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }
}

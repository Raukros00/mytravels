import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripTemplate } from '../../../core/models/trip-template.model';
import { daysLabel, formatBudget } from '../explore.utils';

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD_PX = 50;

@Component({
  selector: 'app-explore-hero-carousel',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mouseenter)': 'paused.set(true)',
    '(mouseleave)': 'paused.set(false)',
    '(focusin)': 'paused.set(true)',
    '(focusout)': 'paused.set(false)',
    '(touchstart)': 'onTouchStart($event)',
    '(touchend)': 'onTouchEnd($event)'
  },
  templateUrl: './explore-hero-carousel.component.html',
  styleUrl: './explore-hero-carousel.component.css'
})
export class ExploreHeroCarouselComponent {
  readonly templates = input.required<TripTemplate[]>();

  protected readonly current = signal(0);
  protected readonly paused = signal(false);
  private touchStartX = 0;

  protected readonly count = computed(() => this.templates().length);

  protected readonly daysLabel = daysLabel;
  protected readonly formatBudget = formatBudget;

  constructor() {
    // Keep the index valid if the list shrinks
    effect(() => {
      if (this.current() >= this.count()) this.current.set(0);
    });

    // Autoplay, paused on hover/focus and skipped for users who prefer reduced motion
    effect(onCleanup => {
      if (this.paused() || this.count() < 2) return;
      if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const timer = setInterval(() => this.next(), AUTOPLAY_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  protected next(): void {
    this.current.update(i => (i + 1) % this.count());
  }

  protected prev(): void {
    this.current.update(i => (i - 1 + this.count()) % this.count());
  }

  protected goTo(index: number): void {
    this.current.set(index);
  }

  protected formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  protected onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].clientX;
  }

  protected onTouchEnd(event: TouchEvent): void {
    const delta = event.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) this.next(); else this.prev();
  }
}

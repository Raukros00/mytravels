import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ExploreService } from '../../../core/services/explore.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { InteractiveMapComponent, MapStopPoint } from '../../../shared/components/map/interactive-map.component';
import { ExploreAssignModalComponent } from '../explore-assign-modal/explore-assign-modal.component';
import { ACTIVITY_ICONS, FOOD_ICONS, daysLabel, formatBudget, formatRating } from '../explore.utils';
import { DayPreviewComponent, DayPreviewItem } from './day-preview/day-preview.component';

/** Days shown in full; the rest is locked until the template is assigned to a group. */
const FREE_DAYS = 2;

function slotStart(slot: string): string {
  return slot.split('-')[0].trim();
}

@Component({
  selector: 'app-explore-detail',
  imports: [RouterLink, DayPreviewComponent, ExploreAssignModalComponent, InteractiveMapComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore-detail.component.html',
  styleUrl: './explore-detail.component.css'
})
export class ExploreDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private exploreService = inject(ExploreService);

  private readonly id = toSignal(this.route.paramMap.pipe(map(p => p.get('id') ?? '')), { initialValue: '' });

  protected readonly template = computed(() => this.exploreService.getById(this.id()));
  protected readonly isAssignOpen = signal(false);
  protected readonly freeDays = FREE_DAYS;

  protected readonly daysLabel = daysLabel;
  protected readonly formatBudget = formatBudget;
  protected readonly formatRating = formatRating;

  protected readonly days = computed(() => {
    const t = this.template();
    if (!t) return [];
    return Array.from({ length: t.durationDays }, (_, i) => {
      const day = i + 1;
      const items: DayPreviewItem[] = [
        ...t.activities.filter(a => a.assignedDay === day).map(a => ({
          id: a.id, timeSlot: a.timeSlot ?? '', name: a.name, icon: ACTIVITY_ICONS[a.category], kind: 'activity' as const
        })),
        ...t.placesToEat.filter(p => p.assignedDay === day).map(p => ({
          id: p.id, timeSlot: p.timeSlot ?? '', name: p.name, icon: FOOD_ICONS[p.category], kind: 'food' as const
        }))
      ].sort((a, b) => slotStart(a.timeSlot).localeCompare(slotStart(b.timeSlot)));
      return { day, items, locked: day > FREE_DAYS };
    });
  });

  protected readonly hasLockedDays = computed(() => this.days().some(d => d.locked));

  /** A few names from across the whole trip, as a teaser. */
  protected readonly highlights = computed(() => {
    const t = this.template();
    if (!t) return [];
    const seenDays = new Set<number>();
    const acts = t.activities.filter(a => {
      if (a.assignedDay == null || seenDays.has(a.assignedDay)) return false;
      seenDays.add(a.assignedDay);
      return true;
    }).slice(0, 4).map(a => ({ name: a.name, icon: ACTIVITY_ICONS[a.category], hint: `Giorno ${a.assignedDay}` }));
    const food = t.placesToEat.slice(0, 2).map(p => ({ name: p.name, icon: FOOD_ICONS[p.category], hint: p.specialties ?? '' }));
    return [...acts, ...food];
  });

  protected readonly mapStops = computed<MapStopPoint[]>(() => {
    const t = this.template();
    if (!t) return [];
    const stops: (MapStopPoint & { start: string })[] = [];
    for (const a of t.activities.filter(x => x.assignedDay === 1 && x.coordinates)) {
      stops.push({ id: a.id, name: a.name, category: 'activity', lat: a.coordinates!.lat, lng: a.coordinates!.lng, address: a.address, timeSlot: a.timeSlot, start: slotStart(a.timeSlot ?? '') });
    }
    for (const p of t.placesToEat.filter(x => x.assignedDay === 1 && x.coordinates)) {
      stops.push({ id: p.id, name: p.name, category: 'food', lat: p.coordinates!.lat, lng: p.coordinates!.lng, address: p.address, timeSlot: p.timeSlot, start: slotStart(p.timeSlot ?? '') });
    }
    return stops.sort((a, b) => a.start.localeCompare(b.start)).map(({ start, ...s }) => s);
  });

  protected readonly mapCenter = computed<[number, number]>(() => {
    const first = this.mapStops()[0];
    return first ? [first.lat, first.lng] : [41.3851, 2.1734];
  });

  protected goBack(): void {
    this.router.navigate(['/explore']);
  }

  protected openAssign(): void {
    this.isAssignOpen.set(true);
  }
}

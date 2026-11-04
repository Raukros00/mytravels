import { Injectable, computed, inject, signal } from '@angular/core';
import { DurationBucket, ExploreFilters, ExploreSort, TripTemplate } from '../models/trip-template.model';
import { Trip } from '../models/trip.model';
import { EXPLORE_CATALOG } from '../data/explore-catalog';
import { TripService } from './trip.service';
import { ToastService } from './toast.service';

const DEFAULT_FILTERS: ExploreFilters = { text: '', tags: [], duration: 'all', maxBudget: 0, sort: 'popular' };

function matchesDuration(days: number, bucket: DurationBucket): boolean {
  switch (bucket) {
    case 'short': return days <= 3;
    case 'medium': return days >= 4 && days <= 5;
    case 'long': return days >= 6;
    default: return true;
  }
}

/** Catalog of ready-made trips ("Esplora"). Mock/local for now: see TECHNICAL_DEBT.md. */
@Injectable({ providedIn: 'root' })
export class ExploreService {
  private tripService = inject(TripService);
  private toastService = inject(ToastService);

  private templatesSignal = signal<TripTemplate[]>(EXPLORE_CATALOG);
  public readonly templates = this.templatesSignal.asReadonly();

  private filtersSignal = signal<ExploreFilters>({ ...DEFAULT_FILTERS });
  public readonly filters = this.filtersSignal.asReadonly();

  /** Tags available in the catalog, most used first. */
  public readonly allTags = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.templatesSignal()) {
      for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag);
  });

  /** The two most used templates get the "Più scelto" badge. */
  public readonly topIds = computed(() =>
    new Set([...this.templatesSignal()].sort((a, b) => b.usesCount - a.usesCount).slice(0, 2).map(t => t.id))
  );

  /** Best rated templates, shown in the Esplora hero carousel. */
  public readonly topRated = computed(() =>
    [...this.templatesSignal()]
      .sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount)
      .slice(0, 5)
  );

  public readonly hasActiveFilters = computed(() => {
    const f = this.filtersSignal();
    return !!f.text.trim() || f.tags.length > 0 || f.duration !== 'all' || f.maxBudget > 0;
  });

  public readonly results = computed(() => {
    const f = this.filtersSignal();
    const text = f.text.trim().toLowerCase();
    const list = this.templatesSignal().filter(t => {
      if (text) {
        const haystack = [t.title, t.destination, t.country, ...t.tags].join(' ').toLowerCase();
        if (!haystack.includes(text)) return false;
      }
      if (f.tags.length > 0 && !f.tags.every(tag => t.tags.includes(tag))) return false;
      if (!matchesDuration(t.durationDays, f.duration)) return false;
      if (f.maxBudget > 0 && t.budgetEstimate > f.maxBudget) return false;
      return true;
    });
    const sorters: Record<ExploreSort, (a: TripTemplate, b: TripTemplate) => number> = {
      popular: (a, b) => b.usesCount - a.usesCount,
      rating: (a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount,
      budget: (a, b) => a.budgetEstimate - b.budgetEstimate
    };
    return list.sort(sorters[f.sort]);
  });

  public setText(text: string): void {
    this.filtersSignal.update(f => ({ ...f, text }));
  }

  public toggleTag(tag: string): void {
    this.filtersSignal.update(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }));
  }

  public setDuration(duration: DurationBucket): void {
    this.filtersSignal.update(f => ({ ...f, duration }));
  }

  public setMaxBudget(maxBudget: number): void {
    this.filtersSignal.update(f => ({ ...f, maxBudget }));
  }

  public setSort(sort: ExploreSort): void {
    this.filtersSignal.update(f => ({ ...f, sort }));
  }

  public resetFilters(): void {
    this.filtersSignal.set({ ...DEFAULT_FILTERS });
  }

  public getById(id: string): TripTemplate | undefined {
    return this.templatesSignal().find(t => t.id === id);
  }

  /** Clones a template into a real, freely editable trip of the group. */
  public assignToGroup(templateId: string, groupId: string, startDate: string): Trip | undefined {
    const template = this.getById(templateId);
    if (!template || !groupId || !startDate) return undefined;

    const trip = this.tripService.createTripFromTemplate(template, groupId, startDate);
    // Local only: usesCount persistence needs the backend (TECHNICAL_DEBT.md)
    this.templatesSignal.update(list => list.map(t => t.id === templateId ? { ...t, usesCount: t.usesCount + 1 } : t));
    this.toastService.success(`"${template.title}" aggiunto al gruppo: ora puoi personalizzarlo! 🎒`);
    return trip;
  }
}

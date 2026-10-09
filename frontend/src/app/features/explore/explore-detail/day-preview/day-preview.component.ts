import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface DayPreviewItem {
  id: string;
  timeSlot: string;
  name: string;
  icon: string;
  kind: 'activity' | 'food';
}

@Component({
  selector: 'app-day-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-preview.component.html',
  styleUrl: './day-preview.component.css'
})
export class DayPreviewComponent {
  readonly day = input.required<number>();
  readonly items = input<DayPreviewItem[]>([]);
  /** Locked days only show the title and the counts. */
  readonly locked = input(false);

  readonly unlock = output<void>();

  protected readonly activitiesCount = computed(() => this.items().filter(i => i.kind === 'activity').length);
  protected readonly foodCount = computed(() => this.items().filter(i => i.kind === 'food').length);

  protected countsLabel(): string {
    const a = this.activitiesCount();
    const f = this.foodCount();
    const parts: string[] = [];
    if (a) parts.push(a === 1 ? '1 attività' : `${a} attività`);
    if (f) parts.push(f === 1 ? '1 locale' : `${f} locali`);
    return parts.join(' · ') || 'Giornata libera';
  }
}

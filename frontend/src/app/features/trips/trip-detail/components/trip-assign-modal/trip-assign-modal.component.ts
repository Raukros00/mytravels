import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { AssignDayResult, formatDayDate } from '../../trip-detail.utils';
import {
  MEAL_DEFAULT_TIMES,
  formatTimeRange,
  isValidTime,
  parseTimeSlot,
  validateTimeRange
} from '../../../../../core/utils/day-schedule.utils';

/** Orari attuali della tappa che si sta pianificando. */
export interface AssignInitial {
  day: number;
  startTime?: string | null;
  endTime?: string | null;
  timeSlot?: string | null;
  /** Pasto del locale (pranzo, cena...), per mostrare l'orario indicativo. */
  meal?: string | null;
}

@Component({
  selector: 'app-trip-assign-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-assign-modal.component.html',
  styleUrls: ['../shared/form-helpers.css', './trip-assign-modal.component.css']
})
export class TripAssignModalComponent {
  readonly isOpen = input(false);
  readonly itemName = input('');
  readonly days = input<number[]>([]);
  readonly startDate = input<string | undefined>();
  readonly initial = input<AssignInitial>({ day: 1 });

  readonly closed = output<void>();
  readonly confirmed = output<AssignDayResult>();

  protected readonly day = signal<number | string>(1);
  protected readonly startTime = signal('');
  protected readonly endTime = signal('');
  /** Testo libero non convertibile in orari (es. "mattina"): resta come nota. */
  protected readonly note = signal('');

  protected readonly error = computed(() => validateTimeRange(this.startTime(), this.endTime()));
  protected readonly mealDefault = computed(() => {
    const meal = this.initial().meal;
    const d = meal ? MEAL_DEFAULT_TIMES[meal] : undefined;
    return d ? formatTimeRange(d.start, d.end) : null;
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        untracked(() => {
          const init = this.initial();
          const parsed = isValidTime(init.startTime) ? null : parseTimeSlot(init.timeSlot);
          this.day.set(init.day);
          this.startTime.set((isValidTime(init.startTime) ? init.startTime : parsed?.start) ?? '');
          this.endTime.set((isValidTime(init.startTime) ? init.endTime : parsed?.end) ?? '');
          this.note.set(parseTimeSlot(init.timeSlot) ? '' : (init.timeSlot ?? ''));
        });
      }
    });
  }

  protected dayLabel(d: number): string {
    return formatDayDate(this.startDate(), d);
  }

  protected confirm(): void {
    if (this.error()) return;
    const start = this.startTime() || null;
    const end = start ? this.endTime() || null : null;
    const note = this.note().trim();
    this.confirmed.emit({
      day: Number(this.day()) || null,
      startTime: start,
      endTime: end,
      // La forma scritta degli orari resta in timeSlot per chi legge solo quello.
      timeSlot: note || (start ? formatTimeRange(start, end).replace('–', ' - ') : '')
    });
  }
}

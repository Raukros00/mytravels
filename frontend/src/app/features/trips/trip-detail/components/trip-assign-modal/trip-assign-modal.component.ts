import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { AssignDayResult, formatDayDate } from '../../trip-detail.utils';

@Component({
  selector: 'app-trip-assign-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-assign-modal.component.html',
  styleUrl: './trip-assign-modal.component.css'
})
export class TripAssignModalComponent {
  readonly isOpen = input(false);
  readonly itemName = input('');
  readonly days = input<number[]>([]);
  readonly startDate = input<string | undefined>();
  readonly initialDay = input(1);
  readonly initialTimeSlot = input('');

  readonly closed = output<void>();
  readonly confirmed = output<AssignDayResult>();

  protected readonly day = signal<number | string>(1);
  protected readonly timeSlot = signal('');

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        untracked(() => {
          this.day.set(this.initialDay());
          this.timeSlot.set(this.initialTimeSlot());
        });
      }
    });
  }

  protected dayLabel(d: number): string {
    return formatDayDate(this.startDate(), d);
  }

  protected confirm(): void {
    this.confirmed.emit({ day: Number(this.day()) || null, timeSlot: this.timeSlot() });
  }
}

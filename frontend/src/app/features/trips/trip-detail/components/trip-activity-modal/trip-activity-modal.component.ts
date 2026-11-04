import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityCategory, TripActivity } from '../../../../../core/models/trip.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';

export type NewActivityValue = Omit<TripActivity, 'id' | 'tripId' | 'coordinates' | 'assignedDay'>;

@Component({
  selector: 'app-trip-activity-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-activity-modal.component.html',
  styleUrls: ['../shared/form-helpers.css', './trip-activity-modal.component.css']
})
export class TripActivityModalComponent {
  readonly isOpen = input(false);
  readonly closed = output<void>();
  readonly saved = output<NewActivityValue>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    category: ['monument' as ActivityCategory, Validators.required],
    address: [''],
    ticketsRequired: [false],
    ticketPrice: [0],
    bookingRequired: [false],
    bookingUrl: [''],
    openingHours: [''],
    closingDays: [''],
    notes: ['']
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) this.form.reset();
    });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name,
      category: val.category || 'monument',
      address: val.address || '',
      ticketsRequired: !!val.ticketsRequired,
      ticketPrice: Number(val.ticketPrice) || 0,
      currency: 'EUR',
      bookingRequired: !!val.bookingRequired,
      bookingUrl: val.bookingUrl || '',
      openingHours: val.openingHours || '',
      closingDays: val.closingDays || '',
      notes: val.notes || ''
    });
  }
}

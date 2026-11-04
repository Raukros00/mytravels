import { ChangeDetectionStrategy, Component, effect, inject, input, output, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccommodationDetails, Trip } from '../../../../../core/models/trip.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';

export type AccommodationFormValue = Omit<AccommodationDetails, 'coordinates'>;

@Component({
  selector: 'app-trip-accommodation-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-accommodation-modal.component.html',
  styleUrls: ['../shared/form-helpers.css']
})
export class TripAccommodationModalComponent {
  readonly isOpen = input(false);
  /** Trip providing the current accommodation and the default check-in/out dates. */
  readonly trip = input<Trip | undefined>();
  readonly closed = output<void>();
  readonly saved = output<AccommodationFormValue>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    address: ['', Validators.required],
    checkInDate: [''],
    checkInTime: ['14:00'],
    checkOutDate: [''],
    checkOutTime: ['11:00'],
    bookingCode: [''],
    phoneOrContact: [''],
    notes: ['']
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      const t = untracked(this.trip);
      const acc = t?.accommodation;
      this.form.patchValue({
        name: acc?.name || '',
        address: acc?.address || '',
        checkInDate: acc?.checkInDate || t?.startDate || '',
        checkInTime: acc?.checkInTime || '14:00',
        checkOutDate: acc?.checkOutDate || t?.endDate || '',
        checkOutTime: acc?.checkOutTime || '11:00',
        bookingCode: acc?.bookingCode || '',
        phoneOrContact: acc?.phoneOrContact || '',
        notes: acc?.notes || ''
      });
    });
  }

  protected save(): void {
    const t = this.trip();
    if (!t || this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name,
      address: val.address,
      checkInDate: val.checkInDate || t.startDate,
      checkInTime: val.checkInTime || '14:00',
      checkOutDate: val.checkOutDate || t.endDate,
      checkOutTime: val.checkOutTime || '11:00',
      bookingCode: val.bookingCode || '',
      phoneOrContact: val.phoneOrContact || '',
      notes: val.notes || ''
    });
  }
}

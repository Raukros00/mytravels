import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodCategory, PriceRange, TripPlaceToEat } from '../../../../../core/models/trip.model';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';

export type NewPlaceValue = Omit<TripPlaceToEat, 'id' | 'tripId' | 'coordinates' | 'assignedDay'>;

@Component({
  selector: 'app-trip-place-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-place-modal.component.html',
  styleUrls: ['../shared/form-helpers.css']
})
export class TripPlaceModalComponent {
  readonly isOpen = input(false);
  readonly closed = output<void>();
  readonly saved = output<NewPlaceValue>();

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    category: ['lunch' as FoodCategory, Validators.required],
    priceRange: ['€€' as PriceRange, Validators.required],
    address: [''],
    specialties: [''],
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
      category: val.category || 'lunch',
      priceRange: val.priceRange || '€€',
      address: val.address || '',
      specialties: val.specialties || '',
      bookingRequired: false,
      openingHours: val.openingHours || '',
      closingDays: val.closingDays || '',
      notes: val.notes || '',
      assignedMeal: val.category || 'lunch'
    });
  }
}

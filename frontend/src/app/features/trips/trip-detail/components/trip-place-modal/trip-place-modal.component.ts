import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodCategory, GeoPoint, PriceRange, TripPlaceToEat } from '../../../../../core/models/trip.model';
import { Poi } from '../../../../../core/services/poi.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { PoiAutocompleteComponent } from '../../../../../shared/components/poi-autocomplete/poi-autocomplete.component';
import { PlaceCoordinates } from '../../../../../shared/components/poi-autocomplete/place-coordinates';
import { PlaceStatusComponent } from '../../../../../shared/components/poi-autocomplete/place-status.component';

/** Valori del form; `coordinates` solo se l'indirizzo viene da un luogo suggerito o trovato sulla mappa. */
export type NewPlaceValue = Omit<TripPlaceToEat, 'id' | 'tripId' | 'assignedDay'>;

@Component({
  selector: 'app-trip-place-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, PoiAutocompleteComponent, PlaceStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-place-modal.component.html',
  styleUrls: ['../shared/form-helpers.css']
})
export class TripPlaceModalComponent {
  readonly isOpen = input(false);
  /** Coordinate della destinazione del viaggio: i suggerimenti vicini compaiono per primi. */
  readonly near = input<GeoPoint | null>(null);
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

  /** Coordinate del locale scelto o trovato: valgono finché l'indirizzo resta quello. */
  protected readonly place = new PlaceCoordinates(this.form.controls.address);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.reset();
        this.place.clear();
      }
    });
  }

  /**
   * Scelta di un suggerimento: compila l'indirizzo e salva le coordinate.
   * Dal campo nome il nome diventa quello del locale; dal campo indirizzo solo se il nome è vuoto.
   */
  protected pickPlace(poi: Poi, from: 'name' | 'address'): void {
    this.place.set(poi.address, { lat: poi.lat, lng: poi.lng });
    const name = this.form.controls.name.value.trim();
    this.form.patchValue({
      address: poi.address,
      ...(from === 'name' || !name ? { name: poi.name } : {})
    });
  }

  /** "Trova sulla mappa": l'indirizzo scritto resta, si aggiungono le coordinate confermate. */
  protected located(poi: Poi): void {
    this.place.set(this.form.controls.address.value, { lat: poi.lat, lng: poi.lng });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name,
      category: val.category || 'lunch',
      priceRange: val.priceRange || '€€',
      address: val.address || '',
      coordinates: this.place.coordinates(),
      specialties: val.specialties || '',
      bookingRequired: false,
      openingHours: val.openingHours || '',
      closingDays: val.closingDays || '',
      notes: val.notes || '',
      assignedMeal: val.category || 'lunch'
    });
  }
}

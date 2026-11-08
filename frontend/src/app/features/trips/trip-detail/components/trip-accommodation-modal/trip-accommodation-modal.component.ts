import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccommodationDetails, Trip } from '../../../../../core/models/trip.model';
import { Poi } from '../../../../../core/services/poi.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { PoiAutocompleteComponent } from '../../../../../shared/components/poi-autocomplete/poi-autocomplete.component';
import { PlaceCoordinates } from '../../../../../shared/components/poi-autocomplete/place-coordinates';
import { PlaceStatusComponent } from '../../../../../shared/components/poi-autocomplete/place-status.component';

/** Valori del form; `coordinates` solo se l'indirizzo ha una posizione (suggerimento, mappa o già salvata). */
export type AccommodationFormValue = AccommodationDetails;

@Component({
  selector: 'app-trip-accommodation-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, PoiAutocompleteComponent, PlaceStatusComponent],
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

  /** Destinazione del viaggio: i suggerimenti vicini compaiono per primi. */
  protected readonly near = computed(() => {
    const t = this.trip();
    return t?.destinationLat != null && t.destinationLng != null ? { lat: t.destinationLat, lng: t.destinationLng } : null;
  });

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

  /** Coordinate dell'alloggio: quelle salvate valgono finché l'indirizzo non cambia. */
  protected readonly place = new PlaceCoordinates(this.form.controls.address);

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
      untracked(() => this.place.set(acc?.address || '', acc?.coordinates));
    });
  }

  /** Scelta di un suggerimento: dal campo nome compila nome e indirizzo; dal campo indirizzo il nome solo se vuoto. */
  protected pickPlace(poi: Poi, from: 'name' | 'address'): void {
    this.place.set(poi.address, { lat: poi.lat, lng: poi.lng });
    const name = this.form.controls.name.value.trim();
    this.form.patchValue({
      address: poi.address,
      ...(from === 'name' || !name ? { name: poi.name } : {})
    });
  }

  protected located(poi: Poi): void {
    this.place.set(this.form.controls.address.value, { lat: poi.lat, lng: poi.lng });
  }

  protected save(): void {
    const t = this.trip();
    if (!t || this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name,
      address: val.address,
      coordinates: this.place.coordinates(),
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

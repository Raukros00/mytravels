import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityCategory, GeoPoint, TripActivity } from '../../../../../core/models/trip.model';
import { Poi } from '../../../../../core/services/poi.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { PoiAutocompleteComponent } from '../../../../../shared/components/poi-autocomplete/poi-autocomplete.component';
import { PlaceCoordinates } from '../../../../../shared/components/poi-autocomplete/place-coordinates';
import { PlaceStatusComponent } from '../../../../../shared/components/poi-autocomplete/place-status.component';

/** Valori del form; `coordinates` solo se l'indirizzo viene da un luogo suggerito. */
export type NewActivityValue = Omit<TripActivity, 'id' | 'tripId' | 'assignedDay'>;

@Component({
  selector: 'app-trip-activity-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, PoiAutocompleteComponent, PlaceStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-activity-modal.component.html',
  styleUrls: ['../shared/form-helpers.css', './trip-activity-modal.component.css']
})
export class TripActivityModalComponent {
  readonly isOpen = input(false);
  /** Coordinate della destinazione del viaggio: i suggerimenti vicini compaiono per primi. */
  readonly near = input<GeoPoint | null>(null);
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

  /** Coordinate del luogo scelto o trovato: valgono finché l'indirizzo resta quello. */
  protected readonly place = new PlaceCoordinates(this.form.controls.address);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.reset();
        this.place.clear();
      }
    });
  }

  /** "Trova sulla mappa": l'indirizzo scritto resta, si aggiungono le coordinate confermate. */
  protected located(poi: Poi): void {
    this.place.set(this.form.controls.address.value, { lat: poi.lat, lng: poi.lng });
  }

  /**
   * Scelta di un suggerimento: compila l'indirizzo e salva le coordinate.
   * Dal campo nome il nome diventa quello del luogo; dal campo indirizzo solo se il nome è vuoto.
   */
  protected pickPlace(poi: Poi, from: 'name' | 'address'): void {
    this.place.set(poi.address, { lat: poi.lat, lng: poi.lng });
    const name = this.form.controls.name.value.trim();
    this.form.patchValue({
      address: poi.address,
      ...(from === 'name' || !name ? { name: poi.name } : {})
    });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.saved.emit({
      name: val.name,
      category: val.category || 'monument',
      address: val.address || '',
      coordinates: this.place.coordinates(),
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

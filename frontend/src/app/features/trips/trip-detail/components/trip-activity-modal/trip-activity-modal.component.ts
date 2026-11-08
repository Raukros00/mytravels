import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivityCategory, GeoPoint, TripActivity } from '../../../../../core/models/trip.model';
import { Poi } from '../../../../../core/services/poi.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { PoiAutocompleteComponent } from '../../../../../shared/components/poi-autocomplete/poi-autocomplete.component';

/** Valori del form; `coordinates` solo se l'indirizzo viene da un luogo suggerito. */
export type NewActivityValue = Omit<TripActivity, 'id' | 'tripId' | 'assignedDay'>;

@Component({
  selector: 'app-trip-activity-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, PoiAutocompleteComponent],
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

  /** Luogo scelto dai suggerimenti: le sue coordinate valgono finché l'indirizzo resta quello. */
  private readonly pickedPlace = signal<{ address: string; coordinates: GeoPoint } | null>(null);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.form.reset();
        this.pickedPlace.set(null);
      }
    });

    // Indirizzo modificato a mano dopo la scelta: le coordinate non sono più affidabili.
    this.form.controls.address.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(address => {
      const picked = this.pickedPlace();
      if (picked && address !== picked.address) this.pickedPlace.set(null);
    });
  }

  /**
   * Scelta di un suggerimento: compila l'indirizzo e salva le coordinate.
   * Dal campo nome il nome diventa quello del luogo; dal campo indirizzo solo se il nome è vuoto.
   */
  protected pickPlace(poi: Poi, from: 'name' | 'address'): void {
    this.pickedPlace.set({ address: poi.address, coordinates: { lat: poi.lat, lng: poi.lng } });
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
      coordinates: this.pickedPlace()?.coordinates,
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

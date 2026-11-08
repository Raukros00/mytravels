import { Signal, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith } from 'rxjs';
import { GeoPoint } from '../../../core/models/trip.model';

/**
 * Coordinate legate a un campo indirizzo: valgono solo finché l'indirizzo resta quello per cui sono
 * state trovate (scelta di un suggerimento, "Trova sulla mappa" o valore già salvato). Se l'indirizzo
 * viene modificato a mano non sono più affidabili e spariscono.
 * Da creare in un contesto di iniezione (campo di un componente).
 */
export class PlaceCoordinates {
  private readonly pinned = signal<{ address: string; coordinates: GeoPoint } | null>(null);
  readonly address: Signal<string>;

  readonly coordinates = computed<GeoPoint | undefined>(() => {
    const p = this.pinned();
    return p && p.address === this.address() ? p.coordinates : undefined;
  });

  /** Indirizzo scritto ma senza coordinate: si può cercare sulla mappa. */
  readonly missing = computed(() => !!this.address().trim() && !this.coordinates());

  constructor(control: FormControl<string>) {
    this.address = toSignal(control.valueChanges.pipe(startWith(control.value)), { initialValue: control.value });
  }

  /** Coordinate per `address` (null o coordinate incomplete = nessuna). */
  set(address: string, coordinates: GeoPoint | null | undefined): void {
    this.pinned.set(coordinates && coordinates.lat != null && coordinates.lng != null ? { address, coordinates } : null);
  }

  clear(): void {
    this.pinned.set(null);
  }
}

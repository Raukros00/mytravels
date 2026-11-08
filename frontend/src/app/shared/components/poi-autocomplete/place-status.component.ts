import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GeoPoint } from '../../../core/models/trip.model';
import { Poi } from '../../../core/services/poi.service';
import { PlaceCoordinates } from './place-coordinates';
import { PoiLocateComponent } from './poi-locate.component';

/**
 * Stato della posizione sotto un campo indirizzo: "sulla mappa" se ha le coordinate, altrimenti
 * l'avviso e il pulsante "Trova sulla mappa". Niente se l'indirizzo è vuoto.
 */
@Component({
  selector: 'app-place-status',
  imports: [PoiLocateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (place().coordinates()) {
      <p class="place-ok">
        <span class="material-symbols-outlined" aria-hidden="true">where_to_vote</span>
        Posizione sulla mappa
      </p>
    } @else if (place().missing()) {
      <div class="place-missing">
        <p class="place-missing-text">
          <span class="material-symbols-outlined" aria-hidden="true">location_off</span>
          Posizione mancante: scegli un suggerimento o cercala sulla mappa.
        </p>
        <app-poi-locate [query]="place().address()" [near]="near()" (located)="located.emit($event)" />
      </div>
    }
  `,
  styles: `
    :host { display: block; margin-top: 0.35rem; }
    .place-ok, .place-missing-text {
      display: flex; align-items: center; gap: 0.3rem; margin: 0; font-size: 0.78rem;
    }
    .place-ok { color: var(--wb-secondary-dark); font-weight: 600; }
    .place-missing { display: flex; flex-direction: column; gap: 0.35rem; }
    .place-missing-text { color: var(--wb-text-secondary); }
    .material-symbols-outlined { font-size: 16px; }
  `
})
export class PlaceStatusComponent {
  readonly place = input.required<PlaceCoordinates>();
  readonly near = input<GeoPoint | null>(null);
  readonly located = output<Poi>();
}

import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { GeoPoint } from '../../../core/models/trip.model';
import { OSM_COPYRIGHT_LINK, Poi, PoiService } from '../../../core/services/poi.service';

type LocateState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'found'; poi: Poi }
  | { kind: 'not-found' };

/**
 * "Trova sulla mappa": geocodifica a posteriori di un indirizzo già scritto (stesso endpoint
 * dell'autocompletamento, con priorità ai luoghi vicini alla destinazione). Propone il primo risultato
 * e lo usa solo dopo la conferma dell'utente: un indirizzo ambiguo non diventa una posizione sbagliata.
 */
@Component({
  selector: 'app-poi-locate',
  templateUrl: './poi-locate.component.html',
  styleUrl: './poi-locate.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoiLocateComponent {
  private readonly pois = inject(PoiService);

  /** Testo da cercare (di solito l'indirizzo). */
  readonly query = input.required<string>();
  /** Posizione di riferimento (destinazione del viaggio): i risultati vicini per primi. */
  readonly near = input<GeoPoint | null>(null);
  /** Nome della tappa, per l'etichetta accessibile del pulsante. */
  readonly stopName = input('');
  readonly located = output<Poi>();

  protected readonly state = signal<LocateState>({ kind: 'idle' });
  protected readonly found = computed(() => { const s = this.state(); return s.kind === 'found' ? s.poi : null; });
  protected readonly osmLink = OSM_COPYRIGHT_LINK;
  private request?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    // Indirizzo cambiato: la proposta (o il "nessun risultato") non vale più.
    effect(() => {
      this.query();
      untracked(() => this.cancel());
    });
  }

  protected search(): void {
    const q = this.query().trim();
    if (!q) return;
    this.request?.unsubscribe();
    this.state.set({ kind: 'searching' });
    this.request = this.pois.search(q, this.near()).subscribe({
      next: res => {
        const poi = res.enabled ? res.results[0] : undefined;
        this.state.set(poi ? { kind: 'found', poi } : { kind: 'not-found' });
      },
      // Servizio non raggiungibile: stesso esito di "nessun risultato", senza errori in console.
      error: () => this.state.set({ kind: 'not-found' })
    });
  }

  protected confirm(poi: Poi): void {
    this.located.emit(poi);
    this.state.set({ kind: 'idle' });
  }

  protected cancel(): void {
    this.request?.unsubscribe();
    this.state.set({ kind: 'idle' });
  }
}

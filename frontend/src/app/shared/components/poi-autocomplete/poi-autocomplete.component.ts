import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector,
  afterNextRender, inject, input, output, signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, map, of, switchMap } from 'rxjs';
import { GeoPoint } from '../../../core/models/trip.model';
import { OSM_COPYRIGHT_LINK, Poi, PoiService } from '../../../core/services/poi.service';

const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

/**
 * Campo di testo con suggerimenti di luoghi (OpenStreetMap, tramite il backend).
 * Riutilizzabile per attrazioni, ristoranti, alloggio: il testo resta sempre libero,
 * i suggerimenti sono un aiuto. Combobox ARIA: frecce per muoversi, Invio per scegliere,
 * Esc per chiudere l'elenco (senza chiudere la modale).
 *
 * Il componente non modifica il valore del campo quando si sceglie un luogo:
 * è il genitore a decidere cosa compilare con l'evento `picked`.
 */
@Component({
  selector: 'app-poi-autocomplete',
  imports: [ReactiveFormsModule],
  templateUrl: './poi-autocomplete.component.html',
  styleUrl: './poi-autocomplete.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoiAutocompleteComponent {
  private readonly pois = inject(PoiService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  readonly control = input.required<FormControl<string>>();
  /** id del campo (per la label `for` esterna) e prefisso degli id dell'elenco. */
  readonly inputId = input.required<string>();
  readonly placeholder = input('');
  /** Posizione di riferimento (es. la destinazione del viaggio): i luoghi vicini compaiono per primi. */
  readonly near = input<GeoPoint | null>(null);
  readonly listLabel = input('Luoghi suggeriti');
  readonly picked = output<Poi>();

  protected readonly results = signal<Poi[]>([]);
  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly osmLink = OSM_COPYRIGHT_LINK;

  /** Solo il testo scritto dall'utente: i valori impostati dal form (reset, scelta) non cercano. */
  private readonly typed$ = new Subject<string>();

  constructor() {
    this.typed$.pipe(
      map(v => v.trim()),
      debounceTime(DEBOUNCE_MS),
      switchMap(q => q.length < MIN_QUERY
        ? of([] as Poi[])
        // Servizio non disponibile: nessun suggerimento, il campo resta a testo libero.
        : this.pois.search(q, this.near()).pipe(
            map(res => (res.enabled ? res.results : [])),
            catchError(() => of([] as Poi[])))),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe(list => {
      this.results.set(list);
      this.active.set(list.length ? 0 : -1);
      const focused = document.activeElement?.id === this.inputId();
      this.setOpen(list.length > 0 && focused);
    });
  }

  protected optionId(i: number): string {
    return `${this.inputId()}-option-${i}`;
  }

  protected onInput(event: Event): void {
    this.typed$.next((event.target as HTMLInputElement).value);
  }

  protected select(poi: Poi): void {
    this.setOpen(false);
    this.results.set([]);
    this.picked.emit(poi);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.results();
    if (!list.length) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.setOpen(true);
          return;
        }
        this.move(Math.min(list.length - 1, this.active() + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.open()) this.move(Math.max(0, this.active() - 1));
        break;
      case 'Enter':
        if (this.open() && this.active() >= 0) {
          event.preventDefault(); // non inviare il form
          this.select(list[this.active()]);
        }
        break;
      case 'Escape':
        if (this.open()) {
          event.stopPropagation(); // chiude l'elenco, non la modale
          this.setOpen(false);
        }
        break;
    }
  }

  protected onBlur(): void {
    this.setOpen(false);
  }

  protected setActive(i: number): void {
    this.active.set(i);
  }

  private move(i: number): void {
    this.active.set(i);
    this.afterRender(() => this.host.nativeElement.querySelector(`#${CSS.escape(this.optionId(i))}`)
      ?.scrollIntoView({ block: 'nearest' }));
  }

  private setOpen(open: boolean): void {
    this.open.set(open);
    // Nella modale (che scorre) l'elenco aperto deve essere visibile, soprattutto su mobile.
    if (open) {
      this.afterRender(() => this.host.nativeElement.querySelector('.poi-dropdown')
        ?.scrollIntoView({ block: 'nearest' }));
    }
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}

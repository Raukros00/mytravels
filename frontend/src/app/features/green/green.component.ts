import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-green',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './green.component.html',
  styleUrl: './green.component.css'
})
export class GreenComponent {
  /**
   * Impegni e contenuti: proposta da confermare con il team (epica #168).
   * Nessun dato numerico finché non è verificato.
   */
  readonly commitments = [
    { icon: 'nutrition', title: 'Mangiare locale e di stagione', text: 'Mettiamo al centro botteghe, mercati e locali di quartiere, con prodotti del territorio.' },
    { icon: 'train', title: 'Spostarsi meglio', text: 'Preferiamo itinerari da fare a piedi, in treno o con i mezzi pubblici, quando ha senso.' },
    { icon: 'recycling', title: 'Meno spreco', text: 'Porzioni da condividere e tavolate di gruppo: si ordina quello che si mangia davvero.' },
    { icon: 'event_repeat', title: 'Viaggi che durano', text: 'Gli itinerari si possono riusare e clonare, invece di ricominciare ogni volta da zero.' }
  ];

  readonly ways = [
    { tag: 'Locali di quartiere', title: 'Suggerimenti fuori dai circuiti di massa', text: 'Vogliamo dare più visibilità a osterie e botteghe locali nelle proposte di viaggio.', icon: 'storefront' },
    { tag: 'Tappe vicine', title: 'Tappe raggruppate per zona', text: 'Un itinerario con le tappe vicine tra loro riduce gli spostamenti inutili.', icon: 'route' },
    { tag: 'Mezzi leggeri', title: 'Spostamenti a basso impatto', text: 'Stiamo valutando come proporre treni, mezzi pubblici e percorsi a piedi tra le tappe.', icon: 'directions_bike' }
  ];

  readonly indicators = [
    { label: 'Emissioni medie per itinerario', note: 'Metodo di calcolo in definizione', status: 'Dato in arrivo', ready: false },
    { label: 'Locali di quartiere nelle proposte', note: 'Classificazione in corso', status: 'In validazione', ready: true },
    { label: 'Viaggi creati a partire da itinerari esistenti', note: 'Da misurare', status: 'Dato in arrivo', ready: false }
  ];

  readonly tips = [
    'Scegli un alloggio vicino alle tappe che ti interessano.',
    'Preferisci treno o mezzi pubblici per gli spostamenti lunghi.',
    'Condividete i piatti: assaggi più cose e sprechi meno.',
    'Porta con te una borraccia e una borsa riutilizzabile.'
  ];

  private checked = signal<Set<number>>(new Set());

  isChecked(i: number): boolean {
    return this.checked().has(i);
  }

  toggleTip(i: number): void {
    const next = new Set(this.checked());
    if (!next.delete(i)) next.add(i);
    this.checked.set(next);
  }
}

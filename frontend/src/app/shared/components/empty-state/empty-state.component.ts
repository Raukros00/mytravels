import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css'
})
export class EmptyStateComponent {
  readonly icon = input('🗺️');
  readonly materialIcon = input('');
  readonly title = input('Nessun elemento trovato');
  readonly description = input( 'Inizia creando il tuo primo itinerario o aggiungendo nuovi dettagli.');
  readonly actionLabel = input('');
  readonly actionIcon = input('');
  readonly actionMaterialIcon = input('add');
  readonly action = output<void>();
}

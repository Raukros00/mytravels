import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css'
})
export class EmptyStateComponent {
  @Input() icon = '🗺️';
  @Input() title = 'Nessun elemento trovato';
  @Input() description = 'Inizia creando il tuo primo itinerario o aggiungendo nuovi dettagli.';
  @Input() actionLabel = '';
  @Input() actionIcon = '➕';
  @Output() action = new EventEmitter<void>();
}

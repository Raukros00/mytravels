import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LiveTripService } from '../../../../core/services/live-trip.service';

/**
 * Riepilogo "Com'è andato il viaggio" (#104): dopo la fine di un viaggio, nella lista dei viaggi (fino a 14 giorni
 * dopo), con tappe fatte e spese totali. Si chiude per sempre con "Chiudi" o aprendo il viaggio.
 */
@Component({
  selector: 'app-trip-recap-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-recap-card.component.html',
  styleUrl: './trip-recap-card.component.css'
})
export class TripRecapCardComponent {
  private readonly liveTrips = inject(LiveTripService);

  /** Uno alla volta: il viaggio finito più di recente. */
  protected readonly recap = computed(() => this.liveTrips.pendingRecaps()[0] ?? null);

  protected dismiss(id: string): void {
    this.liveTrips.dismissRecap(id);
  }
}

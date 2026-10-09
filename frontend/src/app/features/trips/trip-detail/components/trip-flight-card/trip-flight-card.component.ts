import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FlightInfo } from '../../../../../core/models/trip.model';

@Component({
  selector: 'app-trip-flight-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-flight-card.component.html',
  styleUrl: './trip-flight-card.component.css'
})
export class TripFlightCardComponent {
  readonly flight = input<FlightInfo | undefined>();
  readonly direction = input.required<'outbound' | 'return'>();

  protected readonly isOutbound = computed(() => this.direction() === 'outbound');

  protected airportCode(airportStr?: string): string {
    if (!airportStr) return 'AIR';
    const match = airportStr.match(/^[A-Z]{3}/);
    return match ? match[0] : airportStr.substring(0, 3).toUpperCase();
  }

  protected formatDateTime(isoStr?: string): string {
    if (!isoStr) return '--:--';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) + ')';
    } catch {
      return isoStr;
    }
  }
}

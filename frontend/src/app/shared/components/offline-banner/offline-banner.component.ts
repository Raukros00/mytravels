import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';
import { clockLabel, pendingLabel } from '../../../core/utils/offline-queue.utils';

/**
 * Stato offline del viaggio (#109): "Sei offline: stai vedendo i dati salvati alle 09:12" e
 * "N modifiche in attesa di sincronizzazione" (con "Invia ora" quando la rete c'è).
 * Non mostra niente se si è online e non ci sono modifiche in attesa.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offline() || pending()) {
      <div class="offline-banner" data-cy="offline-banner" role="status" [class.offline-banner--offline]="offline()">
        @if (offline()) {
          <p class="offline-line" data-cy="offline-message">
            <span class="material-symbols-outlined" aria-hidden="true">cloud_off</span>
            <span>{{ offlineText() }}</span>
          </p>
        }
        @if (pending(); as count) {
          <p class="offline-line" data-cy="offline-pending">
            <span class="material-symbols-outlined" aria-hidden="true">{{ syncing() ? 'sync' : 'schedule_send' }}</span>
            <span>{{ syncing() ? 'Sincronizzazione in corso…' : pendingText() }}</span>
            @if (!offline() && !syncing()) {
              <button type="button" class="offline-retry" (click)="retry()">Invia ora</button>
            }
          </p>
        }
      </div>
    }
  `,
  styles: `
    .offline-banner { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.6rem 0.8rem; border-radius: var(--wb-radius-md);
      background: var(--wb-accent-surface); border: 1px solid var(--wb-accent-border); color: var(--wb-text-primary); font-size: 0.92rem; }
    .offline-banner--offline { background: var(--wb-secondary-surface); border-color: var(--wb-border); }
    .offline-line { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; line-height: 1.35; }
    .offline-line .material-symbols-outlined { font-size: 1.2rem; color: var(--wb-accent-dark); }
    .offline-retry { margin-left: auto; min-height: 36px; padding: 0 0.75rem; border-radius: var(--wb-radius-full); border: 1px solid var(--wb-accent-border);
      background: transparent; color: var(--wb-accent-dark); font-weight: 600; cursor: pointer; }
  `
})
export class OfflineBannerComponent {
  private readonly network = inject(NetworkStatusService);
  private readonly queue = inject(OfflineQueueService);

  /** Viaggio mostrato: per l'ora dei dati salvati e per contare solo le sue modifiche in attesa. */
  readonly tripId = input<string | null>(null);

  protected readonly offline = this.network.offline;
  protected readonly syncing = this.queue.syncing;

  protected readonly pending = computed(() => {
    const id = this.tripId();
    return this.queue.pending().filter(a => !id || a.tripId === id).length;
  });

  protected readonly offlineText = computed(() => {
    const id = this.tripId();
    const at = id ? this.network.savedAt()[id] : undefined;
    return at ? `Sei offline: stai vedendo i dati salvati alle ${clockLabel(at)}` : 'Sei offline: stai vedendo i dati salvati sul telefono';
  });

  protected readonly pendingText = computed(() => pendingLabel(this.pending()));

  protected retry(): void {
    void this.queue.flush();
  }
}

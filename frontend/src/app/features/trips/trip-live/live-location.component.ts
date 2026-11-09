import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ArrivalStop, arrivalAt } from '../../../core/utils/location.utils';
import { LiveLocationService } from './live-location.service';

/**
 * Posizione del telefono nella guida (#108): pulsante "Usa la mia posizione" (il permesso si chiede solo qui),
 * spiegazione sulla privacy, stato e proposta "Sei arrivato a X? Segna come visitata" entro ~100 m da una tappa.
 * La distanza dalla prossima tappa e la partenza delle indicazioni dalla posizione sono nella scheda "Adesso".
 */
@Component({
  selector: 'app-live-location',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (arrival(); as stop) {
      <section class="loc-arrival" data-cy="live-arrival" role="status">
        <span class="material-symbols-outlined" aria-hidden="true">where_to_vote</span>
        <p class="loc-arrival-text">{{ 'live.location.arrived' | translate: { name: stop.name } }}</p>
        <div class="loc-arrival-actions">
          <button type="button" class="btn btn-primary btn-sm" (click)="confirm(stop)">{{ 'live.location.mark_visited' | translate }}</button>
          <button type="button" class="btn btn-outline btn-sm" (click)="dismiss(stop)">{{ 'live.location.not_yet' | translate }}</button>
        </div>
      </section>
    }

    <div class="loc" data-cy="live-location" [attr.data-status]="location.status()">
      @switch (location.status()) {
        @case ('on') {
          <p class="loc-line">
            <span class="material-symbols-outlined loc-icon loc-icon--on" aria-hidden="true">my_location</span>
            <span>{{ 'live.location.active' | translate }}</span>
            <button type="button" class="loc-link" (click)="location.disable()">{{ 'live.location.disable' | translate }}</button>
          </p>
        }
        @case ('asking') {
          <p class="loc-line">
            <span class="material-symbols-outlined loc-icon" aria-hidden="true">location_searching</span>
            <span>{{ 'live.location.searching' | translate }}</span>
            <button type="button" class="loc-link" (click)="location.disable()">{{ 'live.location.cancel' | translate }}</button>
          </p>
        }
        @default {
          @if (location.status() === 'denied') {
            <p class="loc-line loc-warn" data-cy="live-location-denied">{{ 'live.location.denied' | translate }}</p>
          } @else if (location.status() === 'unavailable') {
            <p class="loc-line loc-warn">{{ 'live.location.unavailable' | translate }}</p>
          }
          <button type="button" class="loc-enable" (click)="location.enable()">
            <span class="material-symbols-outlined" aria-hidden="true">near_me</span>
            {{ 'live.location.enable' | translate }}
          </button>
        }
      }
      <p class="loc-privacy">{{ 'live.location.privacy' | translate }}</p>
    </div>
  `,
  styles: `
    .loc { display: flex; flex-direction: column; gap: 0.3rem; }
    .loc-line { margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; font-size: 0.92rem; color: var(--wb-text-secondary); }
    .loc-icon { font-size: 1.15rem; }
    .loc-icon--on { color: var(--wb-accent-dark); }
    .loc-warn { color: var(--wb-text-primary); }
    .loc-link { margin-left: auto; min-height: 36px; background: none; border: none; padding: 0 0.25rem; color: var(--wb-text-tertiary);
      text-decoration: underline; cursor: pointer; font-size: 0.85rem; }
    .loc-enable { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; min-height: 44px; padding: 0 1rem;
      border-radius: var(--wb-radius-full); border: 1px solid var(--wb-accent-border); background: var(--wb-accent-surface);
      color: var(--wb-accent-dark); font-weight: 600; cursor: pointer; align-self: flex-start; }
    .loc-privacy { margin: 0; font-size: 0.78rem; color: var(--wb-text-tertiary); line-height: 1.35; }
    .loc-arrival { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; padding: 0.75rem 0.9rem;
      border-radius: var(--wb-radius-md); background: var(--wb-success-surface); border: 1px solid var(--wb-border); }
    .loc-arrival > .material-symbols-outlined { font-size: 1.5rem; }
    .loc-arrival-text { margin: 0; flex: 1 1 12rem; font-weight: 600; color: var(--wb-text-primary); }
    .loc-arrival-actions { display: flex; gap: 0.5rem; }
  `
})
export class LiveLocationComponent {
  protected readonly location = inject(LiveLocationService);

  /** Tappe di oggi con coordinate e stato. */
  readonly stops = input<readonly ArrivalStop[]>([]);
  /** Tappa in corso o prossima: in caso di più tappe vicine si propone questa. */
  readonly focusId = input<string | null>(null);
  /** "Segna come visitata" sulla tappa indicata. */
  readonly arrived = output<string>();

  /** Tappe per cui si è risposto "No" (per questa visita della pagina). */
  private readonly dismissed = signal<ReadonlySet<string>>(new Set());

  protected readonly arrival = computed(() => {
    const position = this.location.position();
    if (!position || this.location.status() !== 'on') return null;
    return arrivalAt(position, this.stops(), this.dismissed(), this.focusId());
  });

  protected confirm(stop: ArrivalStop): void {
    this.dismiss(stop);
    this.arrived.emit(stop.id);
  }

  protected dismiss(stop: ArrivalStop): void {
    this.dismissed.set(new Set([...this.dismissed(), stop.id]));
  }
}

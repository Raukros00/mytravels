import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { StorageService } from './storage.service';

export const OFFLINE_SAVED_AT_KEY = 'wb_offline_saved_at';
/** Viaggi di cui si ricorda l'ora di salvataggio (i più recenti). */
const MAX_SAVED = 20;

/**
 * Stato della connessione per l'uso offline (#109), senza dipendere dal service worker (non attivo con `ng serve`):
 * - `navigator.onLine` e gli eventi `online`/`offline` del browser;
 * - le richieste fallite per mancanza di rete (status 0 / 504, vedi `networkInterceptor`): il telefono può
 *   risultare "connesso" in metro o in roaming senza raggiungere il server.
 * Ricorda anche quando sono stati scaricati l'ultima volta i dati di ogni viaggio ("dati salvati alle 09:12").
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StorageService);

  private readonly browserOnline = signal(this.document.defaultView?.navigator.onLine ?? true);
  /** L'ultima richiesta al server è fallita per mancanza di rete. */
  private readonly unreachable = signal(false);
  private readonly savedAtSignal = signal<Record<string, number>>(this.storage.getItem<Record<string, number>>(OFFLINE_SAVED_AT_KEY) ?? {});

  /** Vero se il server non è raggiungibile (browser offline o ultime richieste fallite per la rete). */
  readonly offline = computed(() => !this.browserOnline() || this.unreachable());
  /** Ora (ms) dell'ultimo download dei dati di ogni viaggio. */
  readonly savedAt = this.savedAtSignal.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    if (!view) return;
    const update = () => {
      this.browserOnline.set(view.navigator.onLine);
      // Tornata la rete si riprova: sarà la prossima richiesta a dire se il server risponde.
      if (view.navigator.onLine) this.unreachable.set(false);
    };
    view.addEventListener('online', update);
    view.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      view.removeEventListener('online', update);
      view.removeEventListener('offline', update);
    });
  }

  /** Vero se il browser dice di essere offline: inutile tentare la richiesta. */
  get browserOffline(): boolean {
    return !this.browserOnline();
  }

  /** Chiamato dall'interceptor: una richiesta è fallita per la rete. */
  markUnreachable(): void {
    if (!this.unreachable()) this.unreachable.set(true);
  }

  /** Chiamato dall'interceptor: il server ha risposto. */
  markReachable(): void {
    if (this.unreachable()) this.unreachable.set(false);
  }

  /**
   * I dati del viaggio sono stati scaricati: `serverDate` è l'header `Date` della risposta, che resta quello
   * originale anche quando la risposta arriva dalla cache del service worker (così l'ora è quella vera).
   */
  markSaved(tripId: string, serverDate?: string | null): void {
    const parsed = serverDate ? Date.parse(serverDate) : NaN;
    const at = Number.isFinite(parsed) ? parsed : Date.now();
    const current = this.savedAtSignal();
    if (current[tripId] && current[tripId] >= at) return;
    const entries = Object.entries({ ...current, [tripId]: at }).sort((a, b) => b[1] - a[1]).slice(0, MAX_SAVED);
    const next = Object.fromEntries(entries);
    this.savedAtSignal.set(next);
    this.storage.setItem(OFFLINE_SAVED_AT_KEY, next);
  }

  /** Logout: si dimentica tutto. */
  reset(): void {
    this.savedAtSignal.set({});
    this.unreachable.set(false);
  }
}

import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DevicePosition } from '../../../core/utils/location.utils';

/** Scelta "usa la mia posizione" ricordata sul dispositivo (non la posizione). */
const OPT_IN_KEY = 'wb_live_location';

export type LocationStatus = 'off' | 'asking' | 'on' | 'denied' | 'unavailable';

/**
 * Posizione del telefono per la guida "In viaggio" (#108), fornito dalla pagina della guida (non globale):
 * `watchPosition` è attivo solo mentre la pagina è aperta e visibile e si ferma quando si esce.
 * Il permesso si chiede solo dopo il tocco su "Usa la mia posizione"; alle aperture successive si riparte
 * da soli solo se il permesso è già concesso (nessuna richiesta a sorpresa).
 * La posizione resta in memoria su questo dispositivo: non viene salvata né inviata al server.
 */
@Injectable()
export class LiveLocationService {
  private readonly document = inject(DOCUMENT);
  private watchId: number | null = null;
  /** L'utente ha scelto di usare la posizione (resta finché non la spegne). */
  private wanted = false;

  readonly status = signal<LocationStatus>('off');
  readonly position = signal<DevicePosition | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearWatch());
    void this.resumeIfAllowed();
  }

  private get geolocation(): Geolocation | null {
    return this.document.defaultView?.navigator?.geolocation ?? null;
  }

  /** Tocco su "Usa la mia posizione": qui il browser chiede il permesso. */
  enable(): void {
    if (!this.geolocation) {
      this.status.set('unavailable');
      return;
    }
    this.wanted = true;
    this.saveOptIn(true);
    this.status.set('asking');
    this.watch();
  }

  /** "Non usare più la posizione": si ferma e la dimentica. */
  disable(): void {
    this.wanted = false;
    this.saveOptIn(false);
    this.clearWatch();
    this.position.set(null);
    this.status.set('off');
  }

  /** Pagina nascosta: niente posizione in background. Tornando visibile si riprende. */
  pause(): void {
    this.clearWatch();
  }

  resume(): void {
    if (this.wanted && this.status() !== 'denied' && this.watchId === null) this.watch();
  }

  private watch(): void {
    const geo = this.geolocation;
    if (!geo || this.watchId !== null) return;
    this.watchId = geo.watchPosition(
      p => {
        this.position.set({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() });
        this.status.set('on');
      },
      err => {
        if (err.code === 1) {
          // Permesso negato: la guida funziona come senza posizione.
          this.wanted = false;
          this.saveOptIn(false);
          this.clearWatch();
          this.position.set(null);
          this.status.set('denied');
        } else if (!this.position()) {
          // Posizione non disponibile (es. GPS spento) o tempo scaduto: si continua a provare.
          this.status.set('unavailable');
        }
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
    );
  }

  private clearWatch(): void {
    if (this.watchId !== null) this.geolocation?.clearWatch(this.watchId);
    this.watchId = null;
  }

  /** Scelta già fatta in passato e permesso ancora concesso: si riparte senza chiedere niente. */
  private async resumeIfAllowed(): Promise<void> {
    if (!this.readOptIn() || !this.geolocation) return;
    try {
      const permissions = this.document.defaultView?.navigator?.permissions;
      if (!permissions) return;
      const state = await permissions.query({ name: 'geolocation' as PermissionName });
      if (state.state !== 'granted') return;
    } catch {
      return;
    }
    this.wanted = true;
    this.status.set('asking');
    this.watch();
  }

  private readOptIn(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(OPT_IN_KEY) === 'on';
    } catch {
      return false;
    }
  }

  private saveOptIn(on: boolean): void {
    try {
      if (on) this.document.defaultView?.localStorage.setItem(OPT_IN_KEY, 'on');
      else this.document.defaultView?.localStorage.removeItem(OPT_IN_KEY);
    } catch {
      // Storage non disponibile: la scelta vale solo per questa visita.
    }
  }
}

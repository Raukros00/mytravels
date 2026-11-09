import { Injectable, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  DevicePlatform,
  MapPlace,
  MapsApp,
  availableMapsApps,
  detectPlatform,
  directionsUrl,
  resolveMapsApp
} from '../utils/directions.utils';

const MAPS_APP_KEY = 'wb_maps_app';

/**
 * App di mappe per le indicazioni (#106): quella predefinita del dispositivo (Apple Maps su iPhone, Google Maps
 * altrove) o quella scelta dall'utente, salvata solo su questo dispositivo. Sa anche se la posizione è già
 * stata concessa, senza mai chiederla (la richiesta è la #108): in quel caso le indicazioni partono da dove si è.
 */
@Injectable({ providedIn: 'root' })
export class MapsPreferenceService {
  private readonly document = inject(DOCUMENT);

  readonly platform: DevicePlatform = this.detect();
  /** App disponibili su questo dispositivo, la predefinita per prima. */
  readonly apps = availableMapsApps(this.platform);

  private readonly preferred = signal<string | null>(this.read());
  /** App usata per le indicazioni. */
  readonly app = computed<MapsApp>(() => resolveMapsApp(this.platform, this.preferred()));

  /** Vero se la geolocalizzazione è già concessa al sito (si controlla soltanto, non si chiede). */
  readonly locationGranted = signal(false);

  constructor() {
    this.watchPermission();
  }

  setApp(app: MapsApp): void {
    this.preferred.set(app);
    try {
      this.document.defaultView?.localStorage.setItem(MAPS_APP_KEY, app);
    } catch {
      // Storage bloccato: la scelta vale finché la pagina resta aperta.
    }
  }

  /**
   * Link alle indicazioni verso `destination` con l'app scelta (o `app`). Se la posizione è concessa si parte da
   * dove si è, altrimenti da `fallbackOrigin` (tappa precedente o alloggio).
   */
  url(destination: MapPlace, fallbackOrigin?: MapPlace | null, app: MapsApp = this.app()): string {
    return directionsUrl(app, destination, this.locationGranted() ? null : fallbackOrigin);
  }

  private detect(): DevicePlatform {
    const nav = this.document.defaultView?.navigator;
    return nav ? detectPlatform(nav.userAgent ?? '', nav.maxTouchPoints ?? 0) : 'desktop';
  }

  private read(): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(MAPS_APP_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private watchPermission(): void {
    const permissions = this.document.defaultView?.navigator?.permissions;
    if (!permissions?.query) return;
    permissions.query({ name: 'geolocation' as PermissionName })
      .then(status => {
        this.locationGranted.set(status.state === 'granted');
        status.onchange = () => this.locationGranted.set(status.state === 'granted');
      })
      .catch(() => this.locationGranted.set(false));
  }
}

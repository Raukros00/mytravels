import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LiveTripService } from './live-trip.service';

export type AuthTab = 'login' | 'register';

export interface AuthModalOptions {
  tab?: AuthTab;
  /** Pagina da aprire dopo l'accesso (es. la rotta protetta richiesta). */
  returnUrl?: string | null;
  /** Azione da riprendere dopo l'accesso (es. "Assegna a un gruppo"). */
  onSuccess?: () => void;
}

/**
 * Modale di accesso/registrazione, unica per tutta l'app (stile Airbnb):
 * si apre sopra la pagina corrente invece di portare a una pagina di login.
 */
@Injectable({ providedIn: 'root' })
export class AuthModalService {
  private readonly router = inject(Router);
  private readonly liveTrips = inject(LiveTripService);

  readonly isOpen = signal(false);
  readonly tab = signal<AuthTab>('login');

  private returnUrl: string | null = null;
  private onSuccess: (() => void) | null = null;

  open(options: AuthModalOptions = {}): void {
    this.tab.set(options.tab ?? 'login');
    this.returnUrl = options.returnUrl ?? null;
    this.onSuccess = options.onSuccess ?? null;
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.returnUrl = null;
    this.onSuccess = null;
  }

  /** Da chiamare dopo login o registrazione riusciti. */
  completed(): void {
    const url = this.returnUrl;
    const action = this.onSuccess;
    this.close();
    if (url) this.router.navigateByUrl(url);
    action?.();
    // Accesso senza una pagina o un'azione da riprendere: durante un viaggio si apre la guida di oggi (#104).
    if (!url && !action) {
      this.liveTrips.homeUrl('').subscribe(target => {
        if (target) this.router.navigateByUrl(target);
      });
    }
  }
}

import { Injectable, effect, inject, isDevMode, signal, untracked } from '@angular/core';
import { HttpBackend, HttpClient, HttpHeaders } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, take, timeout } from 'rxjs';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';
import { StorageService } from './storage.service';

/**
 * Stato delle notifiche push su questo dispositivo:
 * - `loading`: verifica in corso
 * - `ios-install`: iPhone/iPad da Safari (app non installata): le push funzionano solo dall'app sulla Home
 * - `unsupported`: il browser non supporta le notifiche push
 * - `server-disabled`: le push non sono attive sul server (chiavi VAPID mancanti)
 * - `denied`: permesso negato nelle impostazioni del browser/telefono
 * - `off` / `on`: disattivate / attive su questo dispositivo
 */
export type PushState = 'loading' | 'ios-install' | 'unsupported' | 'server-disabled' | 'denied' | 'off' | 'on';

/** Le funzioni di SwPush usate qui (nei test e2e sostituite da un client finto, vedi `e2eClient`). */
export interface PushClient {
  readonly isEnabled: boolean;
  requestSubscription(options: { serverPublicKey: string }): Promise<PushSubscription>;
  unsubscribe(): Promise<void>;
  currentSubscription(): Promise<PushSubscription | null>;
}

/** Preferenza del dispositivo (resta dopo il logout): l'utente ha attivato le push qui. */
const PREF_KEY = 'wb_push';
const API = '/api/v1/push';

/**
 * Notifiche push (Web Push) tramite il service worker di Angular.
 * Il permesso del browser si chiede SOLO da `enable()`, cioè dopo un tocco dell'utente (requisito iOS),
 * mai all'avvio. Al logout l'abbonamento del dispositivo viene rimosso; al login viene ripristinato
 * se l'utente le aveva attivate qui e il permesso è già concesso.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http = inject(HttpClient);
  /** HttpClient senza interceptor: al logout il token è già stato tolto dallo storage. */
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly storage = inject(StorageService);
  private readonly client: PushClient = e2eClient() ?? swPushClient(inject(SwPush));

  private readonly stateSignal = signal<PushState>('loading');
  private readonly busySignal = signal(false);
  readonly state = this.stateSignal.asReadonly();
  readonly busy = this.busySignal.asReadonly();

  private publicKey: string | null = null;
  private serverEnabled: boolean | null = null;
  /** Token della sessione corrente, per cancellare l'abbonamento anche dopo il logout. */
  private sessionToken: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();
      untracked(() => {
        if (user) {
          this.sessionToken = this.storage.getJwt();
          void this.restore();
        } else if (this.sessionToken) {
          const token = this.sessionToken;
          this.sessionToken = null;
          void this.removeDevice(token);
        }
      });
    });
  }

  /** iPhone/iPad (anche iPadOS, che si presenta come Mac) da Safari, non installata nella schermata Home. */
  static isIosBrowser(): boolean {
    const nav = navigator as Navigator & { standalone?: boolean };
    const ios = /iPad|iPhone|iPod/.test(nav.userAgent) || (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1);
    const standalone = nav.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
    return ios && !standalone;
  }

  private supported(): boolean {
    return this.client.isEnabled && 'Notification' in window && 'PushManager' in window;
  }

  /** Ricalcola lo stato (all'apertura del profilo). Non chiede mai il permesso. */
  async refresh(): Promise<void> {
    if (PushNotificationService.isIosBrowser()) return this.stateSignal.set('ios-install');
    if (!this.supported()) return this.stateSignal.set('unsupported');
    if (!(await this.loadServerKey())) return this.stateSignal.set('server-disabled');
    if (Notification.permission === 'denied') return this.stateSignal.set('denied');
    const sub = await this.current();
    this.stateSignal.set(sub && Notification.permission === 'granted' ? 'on' : 'off');
  }

  /** Attiva le push. Da chiamare SOLO dal tocco dell'utente: qui il browser chiede il permesso. */
  async enable(): Promise<boolean> {
    if (this.busySignal() || !this.supported()) return false;
    this.busySignal.set(true);
    try {
      if (!(await this.loadServerKey())) {
        this.stateSignal.set('server-disabled');
        return false;
      }
      const sub = await this.client.requestSubscription({ serverPublicKey: this.publicKey! });
      await this.register(sub);
      this.setPref(true);
      this.stateSignal.set('on');
      return true;
    } catch {
      // Permesso negato o finestra chiusa senza scegliere, oppure abbonamento non riuscito.
      this.stateSignal.set(Notification.permission === 'denied' ? 'denied' : 'off');
      return false;
    } finally {
      this.busySignal.set(false);
    }
  }

  /** Disattiva le push su questo dispositivo (server e browser). */
  async disable(): Promise<void> {
    if (this.busySignal()) return;
    this.busySignal.set(true);
    try {
      const sub = await this.current();
      if (sub) {
        await firstValueFrom(this.http.delete(`${API}/subscriptions`, { body: { endpoint: sub.endpoint } })).catch(() => undefined);
        await this.client.unsubscribe().catch(() => undefined);
      }
      this.setPref(false);
      this.stateSignal.set('off');
    } finally {
      this.busySignal.set(false);
    }
  }

  /** Notifica di prova su tutti i dispositivi dell'utente. */
  sendTest(): Promise<unknown> {
    return firstValueFrom(this.http.post(`${API}/test`, {}));
  }

  /** Dopo il login (o all'avvio): se le push erano attive qui e il permesso è già concesso, riallinea l'abbonamento. */
  private async restore(): Promise<void> {
    if (!this.getPref() || !this.supported() || PushNotificationService.isIosBrowser()) return;
    if (Notification.permission !== 'granted') return;
    try {
      if (!(await this.loadServerKey())) return;
      // Con il permesso già concesso requestSubscription non mostra nessuna richiesta.
      const sub = (await this.current()) ?? (await this.client.requestSubscription({ serverPublicKey: this.publicKey! }));
      await this.register(sub);
      if (this.stateSignal() === 'off') this.stateSignal.set('on');
    } catch {
      // Si riprova al prossimo avvio o dal profilo.
    }
  }

  /** Al logout: il dispositivo non deve più ricevere le notifiche dell'account. */
  private async removeDevice(token: string): Promise<void> {
    this.stateSignal.set('loading');
    if (!this.supported()) return;
    const sub = await this.current();
    if (!sub) return;
    await firstValueFrom(this.rawHttp.delete(`${API}/subscriptions`, {
      body: { endpoint: sub.endpoint },
      headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
    })).catch(() => undefined);
    await this.client.unsubscribe().catch(() => undefined);
  }

  private async register(sub: PushSubscription): Promise<void> {
    const json = sub.toJSON();
    await firstValueFrom(this.http.post(`${API}/subscriptions`, {
      endpoint: json.endpoint, keys: json.keys, lang: this.i18n.currentLang(),
    }));
  }

  private current(): Promise<PushSubscription | null> {
    return this.client.currentSubscription().catch(() => null);
  }

  private async loadServerKey(): Promise<boolean> {
    if (this.serverEnabled === null) {
      try {
        const res = await firstValueFrom(this.http.get<{ enabled: boolean; publicKey: string | null }>(`${API}/public-key`));
        this.serverEnabled = !!res.enabled && !!res.publicKey;
        this.publicKey = res.publicKey;
      } catch {
        return false;
      }
    }
    return this.serverEnabled;
  }

  private getPref(): boolean {
    try {
      return localStorage.getItem(PREF_KEY) === 'on';
    } catch {
      return false;
    }
  }

  private setPref(on: boolean): void {
    try {
      if (on) localStorage.setItem(PREF_KEY, 'on');
      else localStorage.removeItem(PREF_KEY);
    } catch {
      // Storage non disponibile (navigazione privata): la preferenza vale solo per questa sessione.
    }
  }
}

function swPushClient(swPush: SwPush): PushClient {
  return {
    isEnabled: swPush.isEnabled,
    requestSubscription: options => swPush.requestSubscription(options),
    unsubscribe: () => swPush.unsubscribe(),
    // Il service worker si registra quando l'app è stabile: al massimo 10 secondi di attesa.
    currentSubscription: () => firstValueFrom(swPush.subscription.pipe(take(1), timeout(10000))),
  };
}

/**
 * Con `ng serve` il service worker non è attivo: i test e2e (solo in sviluppo) forniscono un client
 * finto in `window.__e2ePushClient`. Ignorato nelle build di produzione.
 */
function e2eClient(): PushClient | null {
  if (!isDevMode()) return null;
  return (window as unknown as { __e2ePushClient?: PushClient }).__e2ePushClient ?? null;
}

import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import {
  QueueCollection,
  QueuedAction,
  enqueueAction,
  failureAction,
  hasPendingCreate
} from '../utils/offline-queue.utils';

export const OFFLINE_QUEUE_KEY = 'wb_offline_queue';
/** Con modifiche in attesa si riprova a inviarle ogni tanto, anche senza l'evento `online`. */
const RETRY_MS = 30_000;

const PATHS: Record<QueueCollection, string> = {
  activities: 'activities',
  placesToEat: 'places-to-eat',
  expenses: 'expenses'
};

/** Coda salvata sul dispositivo, legata all'utente che l'ha creata. */
interface StoredQueue { userId: string; actions: QueuedAction[] }

/** Un elemento creato offline è arrivato al server: da `localId` a `saved.id`. */
export interface CreatedEvent { action: QueuedAction; saved: { id: string } & Record<string, unknown> }

/**
 * Coda delle modifiche fatte offline (#109): Fatto / Salta nella guida e le spese. Le azioni restano sul dispositivo
 * (localStorage) e vengono inviate in ordine al ritorno della connessione (evento `online`, risposta del server,
 * ritorno sull'app, o ogni 30 secondi). Funziona anche senza service worker.
 *
 * Conflitti, in modo semplice: per lo stesso elemento vince l'ultima azione (vedi `enqueueAction`), e se il server
 * rifiuta una modifica (es. tappa eliminata nel frattempo da un altro membro) l'azione si scarta con un avviso.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly network = inject(NetworkStatusService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  private readonly queue = signal<QueuedAction[]>(this.load());
  private flushing = false;

  /** Azioni in attesa di essere inviate. */
  readonly pending = this.queue.asReadonly();
  readonly pendingCount = computed(() => this.queue().length);
  readonly syncing = signal(false);

  /** Un elemento creato offline ha ricevuto l'id del server. */
  readonly created$ = new Subject<CreatedEvent>();
  /** Fine di un invio: i viaggi coinvolti vanno ricaricati dal server (anche per le azioni rifiutate). */
  readonly synced$ = new Subject<string[]>();

  constructor() {
    const view = this.document.defaultView;
    const onOnline = () => this.flush();
    view?.addEventListener('online', onOnline);
    const timer = view?.setInterval(() => {
      if (this.queue().length) this.flush();
    }, RETRY_MS);
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('online', onOnline);
      if (timer) view?.clearInterval(timer);
    });

    // Server di nuovo raggiungibile (una qualsiasi risposta): si invia la coda.
    effect(() => {
      if (!this.network.offline() && untracked(() => this.queue().length)) untracked(() => this.flush());
    });
    // La coda appartiene all'utente che l'ha creata: al logout resta salvata (non va persa) ma non si mostra;
    // si riprende quando rientra lo stesso utente, si scarta se entra un altro utente.
    effect(() => {
      const user = this.auth.currentUser();
      untracked(() => {
        if (!user) {
          this.queue.set([]);
          return;
        }
        const stored = this.storage.getItem<StoredQueue>(OFFLINE_QUEUE_KEY);
        if (stored && stored.userId !== user.id) this.storage.removeItem(OFFLINE_QUEUE_KEY);
        this.queue.set(stored?.userId === user.id && Array.isArray(stored.actions) ? stored.actions : []);
      });
    });
  }

  enqueue(action: Omit<QueuedAction, 'id' | 'queuedAt'>): void {
    const full: QueuedAction = { ...action, id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, queuedAt: Date.now() };
    this.save(enqueueAction(this.queue(), full));
  }

  hasPendingCreate(tripId: string, collection: QueueCollection, itemId: string): boolean {
    return hasPendingCreate(this.queue(), tripId, collection, itemId);
  }

  /** Invia le azioni in coda, una alla volta. Si ferma al primo errore di rete (si riproverà più tardi). */
  async flush(): Promise<void> {
    if (this.flushing || !this.queue().length || this.network.browserOffline || !this.auth.currentUser()) return;
    this.flushing = true;
    this.syncing.set(true);
    const touched = new Set<string>();
    const rejected: string[] = [];
    try {
      while (this.queue().length) {
        const action = this.queue()[0];
        try {
          const saved = await firstValueFrom(this.send(action));
          touched.add(action.tripId);
          this.remove(action.id);
          if (action.op === 'create' && saved && typeof saved === 'object' && 'id' in saved) {
            this.created$.next({ action, saved: saved as CreatedEvent['saved'] });
          }
        } catch (err) {
          const status = err instanceof HttpErrorResponse ? err.status : 0;
          const what = failureAction(status);
          if (what !== 'reject') break;
          // Eliminare qualcosa che non c'è più è già il risultato voluto.
          if (!(action.op === 'delete' && status === 404)) rejected.push(action.label);
          touched.add(action.tripId);
          this.remove(action.id);
        }
      }
    } finally {
      this.flushing = false;
      this.syncing.set(false);
    }
    if (rejected.length) {
      this.toast.warning(rejected.length === 1
        ? `Una modifica fatta offline non è stata accettata dal server ("${rejected[0]}"): vale la versione del server.`
        : `${rejected.length} modifiche fatte offline non sono state accettate dal server: vale la versione del server.`, 7000);
    } else if (touched.size && !this.queue().length) {
      this.toast.success('Modifiche fatte offline sincronizzate ✓');
    }
    if (touched.size) this.synced$.next([...touched]);
  }

  private send(action: QueuedAction): Observable<unknown> {
    const base = `/api/v1/trips/${action.tripId}/${PATHS[action.collection]}`;
    if (action.op === 'create') {
      const { id: _localId, ...body } = action.body ?? {};
      return this.api.post(base, body);
    }
    if (action.op === 'update') return this.api.put(`${base}/${action.itemId}`, { ...action.body, id: action.itemId });
    return this.api.delete(`${base}/${action.itemId}`);
  }

  private remove(actionId: string): void {
    this.save(this.queue().filter(a => a.id !== actionId));
  }

  private save(actions: QueuedAction[]): void {
    this.queue.set(actions);
    const user = this.auth.currentUser();
    if (!user) return;
    if (actions.length) this.storage.setItem<StoredQueue>(OFFLINE_QUEUE_KEY, { userId: user.id, actions });
    else this.storage.removeItem(OFFLINE_QUEUE_KEY);
  }

  private load(): QueuedAction[] {
    const stored = this.storage.getItem<StoredQueue>(OFFLINE_QUEUE_KEY);
    const user = this.storage.getCurrentUser();
    return stored && user && stored.userId === user.id && Array.isArray(stored.actions) ? stored.actions : [];
  }
}

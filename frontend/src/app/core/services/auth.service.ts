import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { NetworkStatusService } from './network-status.service';
import { User } from '../models/user.model';
import { LoginDto, RegisterDto, UpdateProfileDto } from '../models/auth.model';
import { USE_MOCK_DATA } from '../config/mock.config';

/** Messaggio per la risposta 429 (troppi tentativi), con l'attesa in minuti arrotondata per eccesso. */
export function tooManyAttemptsMessage(err: { error?: { retryAfterSeconds?: number }; headers?: { get(name: string): string | null } }): string {
  const seconds = Number(err.error?.retryAfterSeconds ?? err.headers?.get('Retry-After') ?? 0);
  const minutes = Math.max(1, Math.ceil((Number.isFinite(seconds) ? seconds : 0) / 60));
  return `Troppi tentativi, riprova tra ${minutes} ${minutes === 1 ? 'minuto' : 'minuti'}.`;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private networkStatus = inject(NetworkStatusService);

  private currentUserSignal = signal<User | null>(this.storageService.getCurrentUser());
  private allUsersSignal = signal<User[]>(this.storageService.getUsers());

  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly platformUsers = this.allUsersSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  constructor() {
    if (USE_MOCK_DATA) return;
    // If we have a JWT token on startup, verify / refresh current user
    const token = this.storageService.getJwt();
    if (!token && this.currentUserSignal()) {
      // Utente in cache senza token: la sessione non è valida, non va considerato autenticato.
      this.currentUserSignal.set(null);
      this.storageService.setCurrentUser(null);
    }
    if (token) {
      this.apiService.get<User>('/auth/me').subscribe({
        next: (user) => {
          this.currentUserSignal.set(user);
          this.storageService.setCurrentUser(user);
        },
        error: (err) => {
          // Token scaduto o non valido. Senza rete (#109: guida offline) o con il server giù si resta
          // collegati con l'utente salvato: l'app deve aprirsi anche offline.
          if (err?.status === 401 || err?.status === 403) this.logout();
          else console.warn('Could not verify the session, keeping the saved user:', err?.status);
        }
      });
    }
  }

  /**
   * Accede e avvia la sessione. Non naviga: chi chiama (la modale di accesso) decide dove andare.
   * In caso di errore l'Observable fallisce con il messaggio da mostrare all'utente.
   */
  public login(dto: LoginDto): Observable<User> {
    if (USE_MOCK_DATA) {
      const user = this.storageService.getCurrentUser();
      if (!user) return throwError(() => new Error('Nessun utente demo disponibile.'));
      this.currentUserSignal.set(user);
      this.toastService.success(`Bentornato, ${user.name}! 👋`);
      return of(user);
    }
    return this.apiService.post<{ token: string; user: User }>('/auth/login', dto).pipe(
      map(res => this.startSession(res)),
      tap(user => this.toastService.success(`Bentornato, ${user.name}! 👋`)),
      catchError(err => throwError(() => new Error(
        err.status === 401 ? 'Email o password non corretti.'
          : err.status === 429 ? tooManyAttemptsMessage(err)
          : (err.error?.message || 'Accesso non riuscito, riprova.')
      )))
    );
  }

  /** Registra il nuovo account e avvia la sessione (vedi `login`). */
  public register(dto: RegisterDto): Observable<User> {
    return this.apiService.post<{ token: string; user: User }>('/auth/register', dto).pipe(
      map(res => this.startSession(res)),
      tap(user => this.toastService.success(`Benvenuto su WanderBite, ${user.name}! 🚀`)),
      catchError(err => throwError(() => new Error(
        err.status === 409 ? 'Esiste già un account con questa email.'
          : err.status === 429 ? tooManyAttemptsMessage(err)
          // Errori sulla password (es. "password: La password è tra le più comuni…"): il messaggio è già in italiano.
          : err.status === 400 && /^password: /.test(err.error?.message ?? '') ? err.error.message.replace(/^password: /, '')
          : (err.error?.message || 'Errore durante la registrazione.')
      )))
    );
  }

  /**
   * Aggiorna i dati personali dell'utente corrente (#120) e la copia salvata in locale.
   * In caso di errore l'Observable fallisce con l'errore HTTP originale (il chiamante sceglie il messaggio).
   */
  public updateProfile(dto: UpdateProfileDto): Observable<User> {
    return this.apiService.put<User>('/api/v1/users/me', dto).pipe(
      tap(user => {
        this.currentUserSignal.set(user);
        this.storageService.setCurrentUser(user);
      })
    );
  }

  private startSession(res: { token: string; user: User }): User {
    this.storageService.setJwt(res.token);
    this.currentUserSignal.set(res.user);
    this.storageService.setCurrentUser(res.user);
    return res.user;
  }

  public logout(): void {
    this.currentUserSignal.set(null);
    this.storageService.clearSessionData();
    this.networkStatus.reset();
    clearOfflineApiCache();
    this.toastService.info('Disconnessione effettuata. A presto!');
    this.router.navigate(['/explore']);
  }
}

/**
 * #109: al logout si eliminano le risposte delle API salvate dal service worker per l'uso offline
 * (cache "ngsw:...:data:..."), così chi usa il dispositivo dopo non vede i dati dell'utente precedente.
 */
function clearOfflineApiCache(): void {
  try {
    if (typeof caches === 'undefined') return;
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ngsw:') && k.includes(':data:')).map(k => caches.delete(k))))
      .catch(() => undefined);
  } catch {
    // Cache API non disponibile (es. contesto non sicuro): niente da pulire.
  }
}

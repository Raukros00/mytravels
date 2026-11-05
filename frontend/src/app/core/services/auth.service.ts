import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { User } from '../models/user.model';
import { LoginDto, RegisterDto } from '../models/auth.model';
import { USE_MOCK_DATA } from '../config/mock.config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private apiService = inject(ApiService);

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
        error: () => {
          // Token expired or invalid
          this.logout();
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
        err.status === 401 ? 'Email o password non corretti.' : (err.error?.message || 'Accesso non riuscito, riprova.')
      )))
    );
  }

  /** Registra il nuovo account e avvia la sessione (vedi `login`). */
  public register(dto: RegisterDto): Observable<User> {
    return this.apiService.post<{ token: string; user: User }>('/auth/register', dto).pipe(
      map(res => this.startSession(res)),
      tap(user => this.toastService.success(`Benvenuto su WanderBite, ${user.name}! 🚀`)),
      catchError(err => throwError(() => new Error(
        err.status === 409 ? 'Esiste già un account con questa email.' : (err.error?.message || 'Errore durante la registrazione.')
      )))
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
    this.toastService.info('Disconnessione effettuata. A presto!');
    this.router.navigate(['/explore']);
  }
}

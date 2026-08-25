import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { User } from '../models/user.model';
import { LoginDto, RegisterDto } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private apiService = inject(ApiService);

  private currentUserSignal = signal<User | null>(this.storageService.getCurrentUser());
  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  constructor() {
    // If we have a JWT token on startup, verify / refresh current user
    const token = this.storageService.getJwt();
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

  public login(dto: LoginDto): void {
    this.apiService.post<{ token: string; user: User }>('/auth/login', dto).subscribe({
      next: (res) => {
        this.storageService.setJwt(res.token);
        this.currentUserSignal.set(res.user);
        this.storageService.setCurrentUser(res.user);
        this.toastService.success(`Bentornato, ${res.user.name}! 👋`);
        this.router.navigate(['/trips']);
      },
      error: (err) => {
        const msg = err.error?.message || 'Email o password non validi.';
        this.toastService.error(msg);
      }
    });
  }

  public register(dto: RegisterDto): void {
    this.apiService.post<{ token: string; user: User }>('/auth/register', dto).subscribe({
      next: (res) => {
        this.storageService.setJwt(res.token);
        this.currentUserSignal.set(res.user);
        this.storageService.setCurrentUser(res.user);
        this.toastService.success(`Benvenuto su WanderBite, ${res.user.name}! 🚀`);
        this.router.navigate(['/trips']);
      },
      error: (err) => {
        const msg = err.error?.message || 'Errore durante la registrazione.';
        this.toastService.error(msg);
      }
    });
  }

  public quickDemoLogin(): void {
    this.login({
      email: 'admin@example.com',
      password: 'admin123'
    });
  }

  public logout(): void {
    this.currentUserSignal.set(null);
    this.storageService.setCurrentUser(null);
    this.storageService.clearJwt();
    this.toastService.info('Disconnessione effettuata. A presto!');
    this.router.navigate(['/login']);
  }
}

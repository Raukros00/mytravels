import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { User } from '../models/user.model';
import { LoginDto, RegisterDto } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  private currentUserSignal = signal<User | null>(this.storageService.getCurrentUser());
  public readonly currentUser = this.currentUserSignal.asReadonly();
  public readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  public login(dto: LoginDto): boolean {
    const users = this.storageService.getUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === dto.email.toLowerCase());

    if (!foundUser) {
      this.toastService.error('Nessun account trovato con questa email. Effettua la registrazione.');
      return false;
    }

    this.currentUserSignal.set(foundUser);
    this.storageService.setCurrentUser(foundUser);
    this.toastService.success(`Bentornato, ${foundUser.name}! 👋`);
    this.router.navigate(['/trips']);
    return true;
  }

  public register(dto: RegisterDto): boolean {
    const users = this.storageService.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === dto.email.toLowerCase());

    if (existing) {
      this.toastService.error('Questa email è già registrata. Effettua il login.');
      return false;
    }

    const newUser: User = {
      id: 'usr_' + Date.now(),
      name: dto.name.trim(),
      email: dto.email.trim(),
      avatar: dto.avatar || '✈️',
      color: dto.color || '#4f46e5',
      joinedDate: new Date().toISOString().split('T')[0]
    };

    const updatedUsers = [...users, newUser];
    this.storageService.setUsers(updatedUsers);
    this.currentUserSignal.set(newUser);
    this.storageService.setCurrentUser(newUser);

    this.toastService.success(`Benvenuto su WanderBite, ${newUser.name}! 🚀`);
    this.router.navigate(['/trips']);
    return true;
  }

  public quickDemoLogin(): void {
    const users = this.storageService.getUsers();
    const demoUser = users[0] || {
      id: 'usr_demo_1',
      name: 'Alessandro Dominici',
      email: 'alessandro@example.com',
      avatar: '👨‍🍳',
      color: '#4f46e5',
      joinedDate: '2026-01-10'
    };

    this.currentUserSignal.set(demoUser);
    this.storageService.setCurrentUser(demoUser);
    this.toastService.success(`Accesso effettuato come ${demoUser.name} (Demo)`);
    this.router.navigate(['/trips']);
  }

  public logout(): void {
    this.currentUserSignal.set(null);
    this.storageService.setCurrentUser(null);
    this.toastService.info('Disconnessione effettuata. A presto!');
    this.router.navigate(['/login']);
  }
}

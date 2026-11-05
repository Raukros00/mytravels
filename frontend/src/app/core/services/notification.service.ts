import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { USE_MOCK_DATA } from '../config/mock.config';
import { Observable, tap } from 'rxjs';

export type NotificationStatus = 'pending' | 'accepted' | 'declined' | 'approved';

/**
 * - group_invite: un membro ti ha invitato (accetti o rifiuti tu)
 * - join_request: qualcuno chiede di entrare in un gruppo di cui sei admin
 * - join_approved / join_declined: esito della tua richiesta di accesso
 */
export type NotificationType = 'group_invite' | 'join_request' | 'join_approved' | 'join_declined';

export interface AppNotification {
  id: string;
  type: NotificationType;
  recipientId: string;
  senderId?: string;
  senderName: string;
  /** Per le notifiche sulle richieste di accesso. */
  requestId?: string;
  groupId: string;
  groupName: string;
  groupIcon: string;
  groupColor: string;
  createdAt: string;
  read: boolean;
  status: NotificationStatus;
}

/** Invito diretto in attesa, come lo vede un membro del gruppo. */
export interface PendingGroupInvite {
  notifId: string;
  recipientId: string;
  name: string;
  avatar?: string;
  color?: string;
  profileImage?: string | null;
  invitedBy?: string;
}

const STORAGE_KEY = 'wb_notifications';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private toastService = inject(ToastService);
  private apiService = inject(ApiService);

  private notificationsSignal = signal<AppNotification[]>(this.load());

  public readonly allNotifications = this.notificationsSignal.asReadonly();

  public readonly userNotifications = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];
    return this.notificationsSignal()
      .filter(n => n.recipientId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  public readonly unreadCount = computed(() =>
    this.userNotifications().filter(n => !n.read).length
  );

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadNotifications();
      } else {
        this.notificationsSignal.set([]);
      }
    });
  }

  public loadNotifications(): void {
    if (USE_MOCK_DATA) return;
    const user = this.authService.currentUser();
    if (!user) return;
    this.apiService.get<AppNotification[]>('/api/v1/notifications').subscribe({
      next: (notifs) => {
        if (!this.authService.currentUser()) return;
        if (notifs) {
          this.persist(notifs);
          // Richiesta di accesso approvata: il nuovo gruppo deve comparire tra i propri.
          if (notifs.some(n => n.type === 'join_approved' && !n.read)) this.groupService.loadGroups();
        }
      },
      error: (err) => console.warn('Could not load notifications from backend:', err)
    });
  }

  private load(): AppNotification[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  private persist(notifications: AppNotification[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    this.notificationsSignal.set(notifications);
  }

  /** Invito diretto: il server ricava mittente e dati del gruppo e controlla che tu ne sia membro. */
  public sendGroupInvite(recipientId: string, groupId: string): Observable<AppNotification> {
    return this.apiService.post<AppNotification>('/api/v1/notifications', { recipientId, groupId });
  }

  /** Inviti diretti ancora in attesa per un gruppo (visibili ai membri), con il profilo dell'invitato. */
  public groupInvites(groupId: string): Observable<PendingGroupInvite[]> {
    return this.apiService.get<PendingGroupInvite[]>(`/api/v1/notifications/group/${groupId}/invites`);
  }

  /** Dopo aver gestito una richiesta di accesso, la relativa notifica non è più da gestire. */
  public markRequestHandled(requestId: string, status: 'approved' | 'declined'): void {
    this.persist(this.notificationsSignal().map(n =>
      n.requestId === requestId ? { ...n, status, read: true } : n
    ));
  }

  /**
   * Accepts on the backend, which adds the user to the group, then reloads the user's groups.
   * The invited group is not in the local list before joining (the API returns only the
   * user's own groups), so its existence is checked after the reload.
   */
  public acceptInvite(notifId: string): void {
    const notif = this.notificationsSignal().find(n => n.id === notifId);
    if (!notif) return;

    this.apiService.put<AppNotification>(`/api/v1/notifications/${notifId}/accept`, {}).subscribe({
      next: () => {
        this.groupService.loadGroups(groups => {
          const joined = groups.some(g => g.id === notif.groupId);
          this.persist(this.notificationsSignal().map(n =>
            n.id === notifId ? { ...n, status: joined ? 'accepted' as const : 'declined' as const, read: true } : n
          ));
          if (joined) {
            this.toastService.success(`Ti sei unito al gruppo "${notif.groupName}"!`);
          } else {
            this.toastService.error(`Il gruppo "${notif.groupName}" non esiste più.`);
          }
        });
      },
      error: (err) => {
        console.error('Error accepting invite on backend:', err);
        this.toastService.error('Non è stato possibile accettare l\'invito.');
      }
    });
  }

  public declineInvite(notifId: string): void {
    this.persist(this.notificationsSignal().map(n =>
      n.id === notifId ? { ...n, status: 'declined' as const, read: true } : n
    ));

    this.apiService.put<AppNotification>(`/api/v1/notifications/${notifId}/decline`, {}).subscribe({
      error: (err) => console.error('Error declining invite on backend:', err)
    });
  }

  /** Revoca un invito diretto inviato a qualcuno (lo può fare un membro del gruppo). */
  public revokeInvite(notifId: string): Observable<unknown> {
    return this.apiService.delete(`/api/v1/notifications/${notifId}`).pipe(
      tap(() => this.persist(this.notificationsSignal().filter(n => n.id !== notifId)))
    );
  }

  public markAllRead(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 10);
    const cutoffISO = cutoff.toISOString();
    this.persist(
      this.notificationsSignal()
        .filter(n => !n.read || n.createdAt >= cutoffISO)
        .map(n => ({ ...n, read: true }))
    );

    if (this.authService.currentUser()) {
      this.apiService.put('/api/v1/notifications/mark-all-read', {}).subscribe({
        error: (err) => console.error('Error marking all read on backend:', err)
      });
    }
  }
}

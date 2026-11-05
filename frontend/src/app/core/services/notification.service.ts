import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { ToastService } from './toast.service';
import { ApiService } from './api.service';
import { USE_MOCK_DATA } from '../config/mock.config';

export type NotificationStatus = 'pending' | 'accepted' | 'declined';

export interface AppNotification {
  id: string;
  type: 'group_invite';
  recipientId: string;
  senderName: string;
  groupId: string;
  groupName: string;
  groupIcon: string;
  groupColor: string;
  createdAt: string;
  read: boolean;
  status: NotificationStatus;
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
    this.apiService.get<AppNotification[]>(`/api/v1/notifications?recipientId=${user.id}`).subscribe({
      next: (notifs) => {
        if (!this.authService.currentUser()) return;
        if (notifs) {
          this.persist(notifs);
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

  public sendGroupInvite(
    recipientId: string,
    senderName: string,
    group: { id: string; name: string; icon: string; color: string }
  ): void {
    const notif: AppNotification = {
      id: 'notif_' + Date.now(),
      type: 'group_invite',
      recipientId,
      senderName,
      groupId: group.id,
      groupName: group.name,
      groupIcon: group.icon,
      groupColor: group.color,
      createdAt: new Date().toISOString(),
      read: false,
      status: 'pending'
    };
    this.persist([...this.notificationsSignal(), notif]);

    this.apiService.post<AppNotification>('/api/v1/notifications', notif).subscribe({
      error: (err) => console.error('Error sending invite to backend:', err)
    });
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

  public revokeInvite(notifId: string): void {
    this.persist(this.notificationsSignal().filter(n => n.id !== notifId));

    this.apiService.delete(`/api/v1/notifications/${notifId}`).subscribe({
      error: (err) => console.error('Error revoking invite on backend:', err)
    });
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

    const user = this.authService.currentUser();
    if (user) {
      this.apiService.put(`/api/v1/notifications/mark-all-read?recipientId=${user.id}`, {}).subscribe({
        error: (err) => console.error('Error marking all read on backend:', err)
      });
    }
  }
}

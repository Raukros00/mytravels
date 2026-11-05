import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { CreateGroupDto, Group } from '../models/group.model';
import { USE_MOCK_DATA } from '../config/mock.config';

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);
  private apiService = inject(ApiService);

  private groupsSignal = signal<Group[]>(this.storageService.getGroups());
  private activeGroupIdSignal = signal<string | null>(this.storageService.getActiveGroupId());

  public readonly groups = this.groupsSignal.asReadonly();
  public readonly activeGroupId = this.activeGroupIdSignal.asReadonly();

  // Active group computed
  public readonly activeGroup = computed(() => {
    const all = this.groupsSignal();
    const id = this.activeGroupIdSignal();
    if (!id) return all[0] || null;
    return all.find(g => g.id === id) || all[0] || null;
  });

  // Current user's groups computed
  // Includes archived groups
  public readonly allUserGroups = computed(() => {
    const user = this.authService.currentUser();
    const all = this.groupsSignal();
    if (!user) return [];
    return all.filter(g => g.members && g.members.some(m => m.id === user.id || m.id === user.email));
  });

  public readonly userGroups = computed(() => this.allUserGroups().filter(g => !g.archived));
  public readonly archivedGroups = computed(() => this.allUserGroups().filter(g => g.archived));

  constructor() {
    // When user authenticates or changes, load groups from backend
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadGroups();
      } else {
        // Logout: niente gruppi dell'utente precedente in memoria.
        this.groupsSignal.set([]);
        this.activeGroupIdSignal.set(null);
      }
    });
  }

  /** Loads the user's groups from the backend; `onLoaded` runs with the fresh list. */
  public loadGroups(onLoaded?: (groups: Group[]) => void): void {
    if (USE_MOCK_DATA) return;
    this.apiService.get<Group[]>('/api/v1/groups').subscribe({
      next: (groups) => {
        // Risposta arrivata dopo il logout: non va rimessa in cache.
        if (!this.authService.currentUser()) return;
        // Il server è la fonte di verità: anche una lista vuota sostituisce la cache.
        const list = groups ?? [];
        this.groupsSignal.set(list);
        this.storageService.setGroups(list);
        if (list.length === 0) {
          this.activeGroupIdSignal.set(null);
          this.storageService.setActiveGroupId(null);
        } else if (!this.activeGroupIdSignal() || !list.find(g => g.id === this.activeGroupIdSignal())) {
          this.setActiveGroup(list[0].id, { silent: true });
        }
        onLoaded?.(list);
      },
      error: (err) => {
        console.warn('Backend unavailable, using cached groups:', err.status, err.error?.message || err.message);
      }
    });
  }

  /** `silent`: scelta automatica (caricamento, creazione), senza il toast "Gruppo attivo". */
  public setActiveGroup(groupId: string, options: { silent?: boolean } = {}): void {
    this.activeGroupIdSignal.set(groupId);
    this.storageService.setActiveGroupId(groupId);
    const found = this.groupsSignal().find(g => g.id === groupId);
    if (found && !options.silent) {
      this.toastService.info(`Gruppo attivo: ${found.name}`);
    }
  }

  /**
   * Crea il gruppo (subito in locale, poi sul backend). `onCreated` riceve il gruppo salvato,
   * con l'id definitivo: serve per le azioni che il backend deve associare al gruppo (es. inviti).
   */
  public createGroup(dto: CreateGroupDto, onCreated?: (created: Group) => void): Group {
    const user = this.authService.currentUser();
    const code = 'GRP-' + Math.random().toString(36).substring(2, 7).toUpperCase();

    const localGroup: Group = {
      id: 'grp_' + Date.now(),
      name: dto.name.trim(),
      description: dto.description.trim(),
      icon: dto.icon || '✈️',
      color: dto.color || '#4f46e5',
      creatorId: user?.id || 'anonymous',
      inviteCode: code,
      createdAt: new Date().toISOString().split('T')[0],
      members: user ? [
        {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: 'admin',
          color: user.color
        }
      ] : []
    };

    // Optimistic local update
    const updated = [...this.groupsSignal(), localGroup];
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.setActiveGroup(localGroup.id, { silent: true });

    // Backend sync
    this.apiService.post<Group>('/api/v1/groups', {
      name: dto.name.trim(),
      description: dto.description.trim(),
      icon: dto.icon || '✈️',
      color: dto.color || '#4f46e5',
      creatorId: user?.id
    }).subscribe({
      next: (created) => {
        const synced = this.groupsSignal().map(g => g.id === localGroup.id ? created : g);
        this.groupsSignal.set(synced);
        this.storageService.setGroups(synced);
        this.setActiveGroup(created.id, { silent: true });
        onCreated?.(created);
      },
      error: (err) => {
        console.error('Error creating group on backend:', err);
      }
    });

    this.toastService.success(`Gruppo "${dto.name}" creato con successo! 🎉`);
    return localGroup;
  }

  public getGroupById(id: string): Group | undefined {
    return this.groupsSignal().find(g => g.id === id);
  }

  public updateGroup(id: string, dto: Partial<CreateGroupDto>): void {
    const updated = this.groupsSignal().map(g => g.id === id ? { ...g, ...dto } : g);
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.apiService.put<Group>(`/api/v1/groups/${id}`, dto).subscribe({
      error: (err) => console.error('Error updating group:', err)
    });
    this.toastService.success('Gruppo aggiornato con successo!');
  }

  private patchGroup(id: string, patch: Partial<Group>): void {
    const updated = this.groupsSignal().map(g => g.id === id ? { ...g, ...patch } : g);
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.apiService.put<Group>(`/api/v1/groups/${id}`, patch).subscribe({
      error: (err) => console.error('Error updating group settings:', err)
    });
  }

  public isMuted(group: Group | null | undefined): boolean {
    const user = this.authService.currentUser();
    return !!user && !!group?.mutedBy?.includes(user.id);
  }

  public setMuted(groupId: string, muted: boolean): void {
    const user = this.authService.currentUser();
    const group = this.groupsSignal().find(g => g.id === groupId);
    if (!user || !group) return;
    const others = (group.mutedBy ?? []).filter(id => id !== user.id);
    this.patchGroup(groupId, { mutedBy: muted ? [...others, user.id] : others });
  }

  public setCurrency(groupId: string, currency: string): void {
    const caller = this.authService.currentUser();
    if (!caller || !this.isAdmin(groupId, caller.id)) {
      this.toastService.error('Solo gli admin possono modificare la valuta.');
      return;
    }
    this.patchGroup(groupId, { currency });
    this.toastService.success('Valuta aggiornata.');
  }

  public setArchived(groupId: string, archived: boolean): void {
    const caller = this.authService.currentUser();
    if (!caller || !this.isAdmin(groupId, caller.id)) {
      this.toastService.error('Solo gli admin possono archiviare il gruppo.');
      return;
    }
    this.patchGroup(groupId, { archived });
  }

  public deleteGroup(id: string): void {
    const group = this.groupsSignal().find(g => g.id === id);
    const updated = this.groupsSignal().filter(g => g.id !== id);
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    if (this.activeGroupIdSignal() === id) {
      const next = updated[0];
      if (next) this.setActiveGroup(next.id);
      else this.activeGroupIdSignal.set(null);
    }
    this.apiService.delete(`/api/v1/groups/${id}`).subscribe({
      error: (err) => console.error('Error deleting group:', err)
    });
    if (group) this.toastService.success(`Gruppo "${group.name}" eliminato.`);
  }

  private isAdmin(groupId: string, userId: string): boolean {
    const group = this.groupsSignal().find(g => g.id === groupId);
    return group?.members.find(m => m.id === userId)?.role === 'admin';
  }

  public setMemberRole(groupId: string, memberId: string, role: 'admin' | 'member'): void {
    const caller = this.authService.currentUser();
    if (!caller || !this.isAdmin(groupId, caller.id)) {
      this.toastService.error('Solo gli admin possono modificare i ruoli.');
      return;
    }
    const updated = this.groupsSignal().map(g =>
      g.id === groupId ? {
        ...g,
        members: g.members.map(m => m.id === memberId ? { ...m, role } : m)
      } : g
    );
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.apiService.put<Group>(`/api/v1/groups/${groupId}/members/${memberId}/role`, { role }).subscribe({
      error: (err) => console.error('Error updating member role on backend:', err)
    });
    this.toastService.success(role === 'admin' ? 'Membro promosso ad admin.' : 'Ruolo rimosso.');
  }

  public addMember(groupId: string, user: { id: string; name: string; avatar: string; color: string }): void {
    const group = this.groupsSignal().find(g => g.id === groupId);
    if (!group) return;
    if (group.members.some(m => m.id === user.id)) return;
    const updated = this.groupsSignal().map(g =>
      g.id === groupId ? {
        ...g,
        members: [...g.members, { id: user.id, name: user.name, avatar: user.avatar, role: 'member' as const, color: user.color }]
      } : g
    );
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
  }

  public removeMember(groupId: string, memberId: string): void {
    const caller = this.authService.currentUser();
    const isSelf = caller?.id === memberId;
    if (!isSelf && (!caller || !this.isAdmin(groupId, caller.id))) {
      this.toastService.error('Solo gli admin possono rimuovere altri membri.');
      return;
    }
    const updated = this.groupsSignal().map(g =>
      g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g
    );
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.apiService.delete(`/api/v1/groups/${groupId}/members/${memberId}`).subscribe({
      error: (err) => console.error('Error removing member:', err)
    });
    if (!isSelf) this.toastService.success('Membro rimosso dal gruppo.');
  }

  // L'ingresso con codice o link passa da una richiesta di accesso approvata da un admin
  // (pagina /join/:code, GroupInviteService).
}

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { CreateGroupDto, Group } from '../models/group.model';

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
  public readonly userGroups = computed(() => {
    const user = this.authService.currentUser();
    const all = this.groupsSignal();
    if (!user) return [];
    return all.filter(g => g.members && g.members.some(m => m.id === user.id || m.id === user.email) || g.creatorId === user.id);
  });

  constructor() {
    // When user authenticates or changes, load groups from backend
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.loadGroups();
      }
    });
  }

  public loadGroups(): void {
    this.apiService.get<Group[]>('/api/v1/groups').subscribe({
      next: (groups) => {
        if (groups && groups.length > 0) {
          this.groupsSignal.set(groups);
          this.storageService.setGroups(groups);
          if (!this.activeGroupIdSignal() || !groups.find(g => g.id === this.activeGroupIdSignal())) {
            this.setActiveGroup(groups[0].id);
          }
        }
      },
      error: (err) => {
        console.warn('Backend unavailable, using cached groups:', err);
      }
    });
  }

  public setActiveGroup(groupId: string): void {
    this.activeGroupIdSignal.set(groupId);
    this.storageService.setActiveGroupId(groupId);
    const found = this.groupsSignal().find(g => g.id === groupId);
    if (found) {
      this.toastService.info(`Gruppo attivo: ${found.name}`);
    }
  }

  public createGroup(dto: CreateGroupDto): Group {
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
    this.setActiveGroup(localGroup.id);

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
        this.setActiveGroup(created.id);
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

  public removeMember(groupId: string, memberId: string): void {
    const updated = this.groupsSignal().map(g =>
      g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId) } : g
    );
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.apiService.delete(`/api/v1/groups/${groupId}/members/${memberId}`).subscribe({
      error: (err) => console.error('Error removing member:', err)
    });
    this.toastService.success('Membro rimosso dal gruppo.');
  }

  public joinGroupByCode(code: string): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;

    const trimmed = code.trim().toUpperCase();

    // Backend call
    this.apiService.post<Group>('/api/v1/groups/join', {
      inviteCode: trimmed,
      userId: user.id,
      userName: user.name,
      avatar: user.avatar,
      color: user.color
    }).subscribe({
      next: (joinedGroup) => {
        const exists = this.groupsSignal().some(g => g.id === joinedGroup.id);
        const updated = exists 
          ? this.groupsSignal().map(g => g.id === joinedGroup.id ? joinedGroup : g)
          : [...this.groupsSignal(), joinedGroup];
        
        this.groupsSignal.set(updated);
        this.storageService.setGroups(updated);
        this.setActiveGroup(joinedGroup.id);
        this.toastService.success(`Ti sei unito al gruppo "${joinedGroup.name}"! 🎊`);
      },
      error: (err) => {
        const msg = err.error?.message || 'Codice gruppo non valido o inesistente.';
        this.toastService.error(msg);
      }
    });

    return true;
  }
}

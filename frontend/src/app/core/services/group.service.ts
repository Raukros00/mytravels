import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { CreateGroupDto, Group } from '../models/group.model';

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private storageService = inject(StorageService);
  private toastService = inject(ToastService);
  private authService = inject(AuthService);

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
    return all.filter(g => g.members.some(m => m.id === user.id) || g.creatorId === user.id);
  });

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

    const newGroup: Group = {
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

    const updated = [...this.groupsSignal(), newGroup];
    this.groupsSignal.set(updated);
    this.storageService.setGroups(updated);
    this.setActiveGroup(newGroup.id);

    this.toastService.success(`Gruppo "${newGroup.name}" creato con successo! 🎉`);
    return newGroup;
  }

  public getGroupById(id: string): Group | undefined {
    return this.groupsSignal().find(g => g.id === id);
  }

  public joinGroupByCode(code: string): boolean {
    const user = this.authService.currentUser();
    if (!user) return false;

    const trimmed = code.trim().toUpperCase();
    const found = this.groupsSignal().find(g => g.inviteCode.toUpperCase() === trimmed);

    if (!found) {
      this.toastService.error('Codice gruppo non valido o inesistente.');
      return false;
    }

    if (found.members.some(m => m.id === user.id)) {
      this.toastService.info('Fai già parte di questo gruppo!');
      this.setActiveGroup(found.id);
      return true;
    }

    const updatedMembers = [
      ...found.members,
      {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: 'member' as const,
        color: user.color
      }
    ];

    const updatedGroup = { ...found, members: updatedMembers };
    const updatedAll = this.groupsSignal().map(g => g.id === found.id ? updatedGroup : g);

    this.groupsSignal.set(updatedAll);
    this.storageService.setGroups(updatedAll);
    this.setActiveGroup(found.id);
    this.toastService.success(`Ti sei unito al gruppo "${found.name}"! 🎊`);
    return true;
  }
}

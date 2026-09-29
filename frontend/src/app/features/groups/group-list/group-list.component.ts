import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { ToastService } from '../../../core/services/toast.service';
import { Group } from '../../../core/models/group.model';
import { GroupCreateModalComponent } from '../group-create-modal/group-create-modal.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    TranslatePipe,
    GroupCreateModalComponent,
    ModalComponent,
    EmptyStateComponent
  ],
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.css'
})
export class GroupListComponent {
  public authService = inject(AuthService);
  public groupService = inject(GroupService);
  private toastService = inject(ToastService);

  public leaveConfirmGroup = signal<Group | null>(null);
  public editingGroup = signal<Group | null>(null);

  openEditModal(group: Group, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    this.editingGroup.set(group);
  }

  openLeaveConfirm(group: Group, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.set(null);
    const user = this.authService.currentUser();
    if (!user) return;
    const member = group.members.find(m => m.id === user.id);
    if (member?.role === 'admin') {
      const otherAdmins = group.members.filter(m => m.id !== user.id && m.role === 'admin');
      if (otherAdmins.length === 0) {
        this.toastService.error('Non puoi uscire dal gruppo finché non assegni un altro admin.');
        return;
      }
    }
    this.leaveConfirmGroup.set(group);
  }

  confirmLeave(): void {
    const group = this.leaveConfirmGroup();
    const user = this.authService.currentUser();
    if (!group || !user) return;
    this.groupService.removeMember(group.id, user.id);
    this.leaveConfirmGroup.set(null);
    this.toastService.success(`Hai lasciato il gruppo "${group.name}".`);
  }

  isGroupCreator(group: Group): boolean {
    const user = this.authService.currentUser();
    return !!user && group.creatorId === user.id;
  }

  readonly MAX_AVATARS = 4;

  public isCreateModalOpen = signal(false);
  public isJoinModalOpen = signal(false);
  public openMenuId = signal<string | null>(null);
  public openMenuDirection = signal<'up' | 'down'>('down');
  public revealedCodes = signal<Set<string>>(new Set());

  toggleCode(groupId: string): void {
    this.revealedCodes.update(s => {
      const next = new Set(s);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }
  public inviteCodeInput = '';

  @HostListener('document:click')
  closeMenu(): void {
    this.openMenuId.set(null);
  }

  toggleMenu(groupId: string, event: MouseEvent): void {
    event.stopPropagation();
    if (this.openMenuId() === groupId) {
      this.openMenuId.set(null);
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    this.openMenuDirection.set(window.innerHeight - rect.bottom < 160 ? 'up' : 'down');
    this.openMenuId.set(groupId);
  }

  shareGroup(group: { name: string; inviteCode: string }): void {
    const text = `Unisciti al gruppo "${group.name}" su WanderBite! Codice: ${group.inviteCode}`;
    if (navigator.share) {
      navigator.share({ title: group.name, text });
    } else {
      navigator.clipboard.writeText(text);
      this.toastService.success('Link di condivisione copiato negli appunti!');
    }
  }

  isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

  onJoinGroup(): void {
    if (!this.inviteCodeInput.trim()) return;

    const success = this.groupService.joinGroupByCode(this.inviteCodeInput);
    if (success) {
      this.inviteCodeInput = '';
      this.isJoinModalOpen.set(false);
    }
  }
}

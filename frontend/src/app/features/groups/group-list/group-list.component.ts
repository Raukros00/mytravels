import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService, LAST_ADMIN_LEAVE_MESSAGE } from '../../../core/services/group.service';
import { GroupInviteService } from '../../../core/services/group-invite.service';
import { ToastService } from '../../../core/services/toast.service';
import { Group } from '../../../core/models/group.model';
import { GroupCreateModalComponent } from '../group-create-modal/group-create-modal.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: { '(document:click)': 'closeMenu()' },
  selector: 'app-group-list',
  imports: [
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
  private router = inject(Router);
  private groupInvites = inject(GroupInviteService);

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
    if (this.groupService.isLastAdmin(group, user.id)) {
      this.toastService.error(LAST_ADMIN_LEAVE_MESSAGE);
      return;
    }
    this.leaveConfirmGroup.set(group);
  }

  /** Nella conferma di uscita: l'utente è l'ultimo membro, quindi il gruppo verrà eliminato. */
  readonly leaveDeletesGroup = computed(() =>
    this.groupService.isLastMember(this.leaveConfirmGroup(), this.authService.currentUser()?.id));

  confirmLeave(): void {
    const group = this.leaveConfirmGroup();
    const user = this.authService.currentUser();
    if (!group || !user) return;
    const deletesGroup = this.leaveDeletesGroup();
    this.groupService.removeMember(group.id, user.id);
    this.leaveConfirmGroup.set(null);
    this.toastService.success(deletesGroup
      ? `Hai lasciato il gruppo "${group.name}", che è stato eliminato.`
      : `Hai lasciato il gruppo "${group.name}".`);
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
  public inviteCodeInput = signal('');

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
    const url = this.groupInvites.inviteLink(group.inviteCode);
    const text = `Unisciti al gruppo "${group.name}" su WanderBite! Apri il link e chiedi l'accesso (codice: ${group.inviteCode})`;
    if (navigator.share) {
      navigator.share({ title: group.name, text, url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      this.toastService.success('Link di invito copiato negli appunti!');
    }
  }

  isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

  /** Il codice porta alla stessa pagina del link invito: anteprima del gruppo e richiesta di accesso. */
  onJoinGroup(): void {
    const code = this.inviteCodeInput().trim().toUpperCase();
    if (!code) return;
    this.inviteCodeInput.set('');
    this.isJoinModalOpen.set(false);
    this.router.navigate(['/join', code]);
  }
}

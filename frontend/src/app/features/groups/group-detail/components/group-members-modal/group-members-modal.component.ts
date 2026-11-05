import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { NotificationService, PendingGroupInvite } from '../../../../../core/services/notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';
import { GroupMembersListComponent } from '../group-members-list/group-members-list.component';

@Component({
  selector: 'app-group-members-modal',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, GroupMembersListComponent, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-members-modal.component.html',
  styleUrl: './group-members-modal.component.css'
})
export class GroupMembersModalComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);

  readonly isOpen = input(false);
  readonly group = input<Group | null>(null);
  readonly isAdmin = input(false);

  readonly closeModal = output<void>();
  readonly leave = output<void>();

  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  /** Inviti diretti ancora in attesa, letti dal server a ogni apertura. */
  readonly pendingInvites = signal<PendingGroupInvite[]>([]);

  constructor() {
    effect(() => {
      const g = this.group();
      if (!this.isOpen() || !g) return;
      untracked(() => this.notificationService.groupInvites(g.id).subscribe({
        next: invites => this.pendingInvites.set(invites),
        error: () => this.pendingInvites.set([])
      }));
    });
  }

  revokeInvite(notifId: string): void {
    this.notificationService.revokeInvite(notifId).subscribe({
      next: () => this.pendingInvites.update(list => list.filter(i => i.notifId !== notifId)),
      error: () => this.toastService.error('Non è stato possibile revocare l\'invito.')
    });
  }
}

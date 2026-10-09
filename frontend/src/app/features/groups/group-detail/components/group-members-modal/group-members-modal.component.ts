import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { GroupMembersListComponent } from '../group-members-list/group-members-list.component';

@Component({
  selector: 'app-group-members-modal',
  imports: [ModalComponent, TranslatePipe, GroupMembersListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-members-modal.component.html',
  styleUrl: './group-members-modal.component.css'
})
export class GroupMembersModalComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  readonly isOpen = input(false);
  readonly group = input<Group | null>(null);
  readonly isAdmin = input(false);

  readonly closeModal = output<void>();
  readonly leave = output<void>();

  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  readonly pendingInvites = computed(() => {
    const g = this.group();
    if (!g) return [];
    const users = this.authService.platformUsers();
    const seen = new Set<string>();
    return this.notificationService.allNotifications()
      .filter(n => n.groupId === g.id && n.status === 'pending')
      .filter(n => {
        if (seen.has(n.recipientId)) return false;
        seen.add(n.recipientId);
        return true;
      })
      .map(n => {
        const user = users.find(u => u.id === n.recipientId);
        return {
          notifId: n.id,
          recipientId: n.recipientId,
          name: user?.name ?? 'Utente',
          avatar: user?.avatar ?? '👤',
          color: user?.color ?? '#9ca3af'
        };
      });
  });

  revokeInvite(notifId: string): void {
    this.notificationService.revokeInvite(notifId);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../../../../core/services/auth.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { Group } from '../../../../../core/models/group.model';

@Component({
  selector: 'app-group-invite-picker',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-invite-picker.component.html',
  styleUrl: './group-invite-picker.component.css'
})
export class GroupInvitePickerComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  readonly group = input<Group | null>(null);
  readonly isEditMode = input(false);
  /** Ids of the users selected to be invited. */
  readonly invitedIds = model<string[]>([]);
  readonly search = model('');

  readonly pendingRecipientIds = computed(() => {
    const g = this.group();
    if (!g) return new Set<string>();
    return new Set(
      this.notificationService.allNotifications()
        .filter(n => n.groupId === g.id && n.status === 'pending')
        .map(n => n.recipientId)
    );
  });

  readonly searchResults = computed(() => {
    const q = this.search().toLowerCase().trim();
    if (!q) return [];
    const me = this.authService.currentUser();
    const memberIds = new Set(this.group()?.members.map(m => m.id) ?? []);
    const invitedIds = new Set(this.invitedIds());
    return this.authService.platformUsers()
      .filter(u => u.id !== me?.id && !memberIds.has(u.id) && !invitedIds.has(u.id))
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  readonly invitedUserDetails = computed(() => {
    const ids = this.invitedIds();
    return this.authService.platformUsers().filter(u => ids.includes(u.id));
  });

  inviteUser(userId: string): void {
    this.invitedIds.update(ids => [...ids, userId]);
    this.search.set('');
  }

  removeInvite(userId: string): void {
    this.invitedIds.update(ids => ids.filter(id => id !== userId));
  }
}

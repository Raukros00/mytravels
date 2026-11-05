import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { PublicUser } from '../../../../../core/models/invite.model';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';
import { UserSearchComponent } from '../../../../../shared/components/user-search/user-search.component';

/** Utenti da invitare alla creazione/modifica del gruppo: gli inviti partono quando il gruppo è salvato. */
@Component({
  selector: 'app-group-invite-picker',
  standalone: true,
  imports: [TranslatePipe, UserSearchComponent, UserAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-invite-picker.component.html',
  styleUrl: './group-invite-picker.component.css'
})
export class GroupInvitePickerComponent {
  readonly group = input<Group | null>(null);
  readonly isEditMode = input(false);
  /** Utenti selezionati da invitare. */
  readonly invited = model<PublicUser[]>([]);

  readonly memberIds = computed(() => this.group()?.members.map(m => m.id) ?? []);
  readonly invitedIds = computed(() => this.invited().map(u => u.id));

  inviteUser(user: PublicUser): void {
    if (this.invitedIds().includes(user.id)) return;
    this.invited.update(list => [...list, user]);
  }

  removeInvite(userId: string): void {
    this.invited.update(list => list.filter(u => u.id !== userId));
  }
}

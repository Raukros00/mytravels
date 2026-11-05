import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { GroupJoinRequest } from '../../../../../core/models/invite.model';
import { GroupInviteService } from '../../../../../core/services/group-invite.service';
import { GroupService } from '../../../../../core/services/group.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { UserAvatarComponent } from '../../../../../shared/components/user-avatar/user-avatar.component';

/** Richieste di accesso in attesa (da link o codice invito): gli admin le accettano o rifiutano. */
@Component({
  selector: 'app-group-join-requests',
  imports: [TranslatePipe, UserAvatarComponent],
  templateUrl: './group-join-requests.component.html',
  styleUrl: './group-join-requests.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupJoinRequestsComponent {
  private readonly invites = inject(GroupInviteService);
  private readonly groupService = inject(GroupService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);

  readonly groupId = input.required<string>();
  readonly isAdmin = input(false);

  protected readonly requests = signal<GroupJoinRequest[]>([]);
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.groupId();
      const admin = this.isAdmin();
      untracked(() => {
        this.requests.set([]);
        if (!admin) return;
        this.invites.pendingRequests(id).subscribe({
          next: list => this.requests.set(list),
          error: () => this.requests.set([])
        });
      });
    });
  }

  protected decide(request: GroupJoinRequest, approve: boolean): void {
    if (this.busyId()) return;
    this.busyId.set(request.id);
    this.invites.decide(this.groupId(), request.id, approve).subscribe({
      next: () => {
        this.busyId.set(null);
        this.requests.update(list => list.filter(r => r.id !== request.id));
        this.notificationService.markRequestHandled(request.id, approve ? 'approved' : 'declined');
        if (approve) {
          this.groupService.loadGroups(); // il nuovo membro compare nell'elenco
          this.toastService.success(`${request.userName} è entrato nel gruppo.`);
        } else {
          this.toastService.info(`Richiesta di ${request.userName} rifiutata.`);
        }
      },
      error: err => {
        this.busyId.set(null);
        // Già gestita da un altro admin: la tolgo comunque dall'elenco.
        if (err.status === 409) this.requests.update(list => list.filter(r => r.id !== request.id));
        this.toastService.error(err.error?.message || 'Non è stato possibile gestire la richiesta.');
      }
    });
  }
}

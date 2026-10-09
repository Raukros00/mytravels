import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { User } from '../../../../../core/models/user.model';
import { AuthService } from '../../../../../core/services/auth.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-group-share-modal',
  imports: [ModalComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-share-modal.component.html',
  styleUrl: './group-share-modal.component.css'
})
export class GroupShareModalComponent {
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);

  readonly isOpen = input(false);
  readonly group = input<Group | null>(null);
  readonly closeModal = output<void>();

  readonly codeVisible = signal(false);
  readonly customMessage = signal('');
  readonly inviteSearch = signal('');
  readonly invitedThisSession = signal<string[]>([]);

  readonly pendingRecipientIds = computed(() => {
    const g = this.group();
    if (!g) return new Set<string>();
    return new Set(
      this.notificationService.allNotifications()
        .filter(n => n.groupId === g.id && n.status === 'pending')
        .map(n => n.recipientId)
    );
  });

  readonly invitedThisSessionUsers = computed(() => {
    const ids = this.invitedThisSession();
    return this.authService.platformUsers().filter(u => ids.includes(u.id));
  });

  readonly searchResults = computed(() => {
    const q = this.inviteSearch().toLowerCase().trim();
    const me = this.authService.currentUser();
    const memberIds = new Set(this.group()?.members.map(m => m.id) ?? []);
    return this.authService.platformUsers()
      .filter(u => u.id !== me?.id && !memberIds.has(u.id))
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  constructor() {
    // Reset the modal state every time it is opened.
    effect(() => {
      if (!this.isOpen()) return;
      untracked(() => {
        const g = this.group();
        if (!g) return;
        this.customMessage.set(
          `Unisciti al gruppo "${g.name}" su WanderBite! 🌍\nUsa il codice invito: ${g.inviteCode}\n👉 ${window.location.origin}`
        );
        this.inviteSearch.set('');
        this.invitedThisSession.set([]);
      });
    });
  }

  onClose(): void {
    this.codeVisible.set(false);
    this.inviteSearch.set('');
    this.invitedThisSession.set([]);
    this.closeModal.emit();
  }

  inviteUser(user: User): void {
    const g = this.group();
    const me = this.authService.currentUser();
    if (!g || !me) return;
    this.notificationService.sendGroupInvite(user.id, me.name, g);
    this.invitedThisSession.update(ids => [...ids, user.id]);
    this.inviteSearch.set('');
    this.toastService.success(`Invito inviato a ${user.name}!`);
  }

  copyMessage(): void {
    navigator.clipboard.writeText(this.customMessage());
    this.toastService.success('Messaggio copiato negli appunti!');
  }
}

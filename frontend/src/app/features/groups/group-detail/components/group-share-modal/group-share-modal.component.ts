import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Group } from '../../../../../core/models/group.model';
import { PublicUser } from '../../../../../core/models/invite.model';
import { GroupInviteService } from '../../../../../core/services/group-invite.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { UserSearchComponent } from '../../../../../shared/components/user-search/user-search.component';

/**
 * Invitare nel gruppo: link (con il codice dentro) o codice da condividere — chi li usa invia una
 * richiesta che un admin approva — oppure invito diretto a un utente cercato per nome/email.
 */
@Component({
  selector: 'app-group-share-modal',
  standalone: true,
  imports: [ModalComponent, TranslatePipe, UserSearchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-share-modal.component.html',
  styleUrl: './group-share-modal.component.css'
})
export class GroupShareModalComponent {
  private readonly invites = inject(GroupInviteService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);

  readonly isOpen = input(false);
  readonly group = input<Group | null>(null);
  readonly closeModal = output<void>();

  readonly codeVisible = signal(false);
  readonly customMessage = signal('');
  /** Utenti con un invito diretto in attesa (dal server) o invitati ora. */
  readonly invitedIds = signal<string[]>([]);
  readonly canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  readonly inviteLink = computed(() => {
    const g = this.group();
    return g ? this.invites.inviteLink(g.inviteCode) : '';
  });
  readonly memberIds = computed(() => this.group()?.members.map(m => m.id) ?? []);

  constructor() {
    // Reset the modal state every time it is opened.
    effect(() => {
      if (!this.isOpen()) return;
      untracked(() => {
        const g = this.group();
        if (!g) return;
        this.codeVisible.set(false);
        this.customMessage.set(
          `Unisciti al gruppo "${g.name}" su WanderBite! 🌍\n` +
          `Apri il link e chiedi l'accesso: ${this.invites.inviteLink(g.inviteCode)}\n` +
          `Oppure usa il codice invito: ${g.inviteCode}`
        );
        this.invitedIds.set([]);
        this.notificationService.groupInvites(g.id).subscribe({
          next: pending => this.invitedIds.update(ids => [...new Set([...ids, ...pending.map(n => n.recipientId)])]),
          error: () => undefined
        });
      });
    });
  }

  onClose(): void {
    this.codeVisible.set(false);
    this.closeModal.emit();
  }

  inviteUser(user: PublicUser): void {
    const g = this.group();
    if (!g) return;
    this.notificationService.sendGroupInvite(user.id, g.id).subscribe({
      next: () => {
        this.invitedIds.update(ids => [...ids, user.id]);
        this.toastService.success(`Invito inviato a ${user.name}!`);
      },
      error: err => this.toastService.error(err.error?.message || 'Non è stato possibile inviare l\'invito.')
    });
  }

  copyLink(): void {
    this.copy(this.inviteLink(), 'Link di invito copiato negli appunti!');
  }

  copyCode(): void {
    const g = this.group();
    if (g) this.copy(g.inviteCode, 'Codice invito copiato negli appunti!');
  }

  shareLink(): void {
    const g = this.group();
    if (!g || !this.canNativeShare) return;
    navigator.share({ title: g.name, text: `Unisciti al gruppo "${g.name}" su WanderBite!`, url: this.inviteLink() })
      .catch(() => undefined); // condivisione annullata dall'utente
  }

  copyMessage(): void {
    this.copy(this.customMessage(), 'Messaggio copiato negli appunti!');
  }

  private copy(text: string, success: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.toastService.success(success),
      () => this.toastService.error('Non è stato possibile copiare: seleziona il testo e copialo a mano.')
    );
  }
}

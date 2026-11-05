import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GroupInvitePreview } from '../../../core/models/invite.model';
import { GroupInviteService } from '../../../core/services/group-invite.service';

type ViewState = 'loading' | 'invalid' | 'error' | 'ready';

const isImageIcon = (icon?: string): boolean =>
  !!icon && (icon.startsWith('data:') || icon.startsWith('http'));

/**
 * Pagina del link invito (/join/:code): mostra il gruppo e chiede se inviare la richiesta di accesso,
 * che un admin dovrà approvare. Lo stesso flusso vale per il codice inserito a mano.
 */
@Component({
  selector: 'app-group-join',
  imports: [RouterLink],
  templateUrl: './group-join.component.html',
  styleUrl: './group-join.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupJoinComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly invites = inject(GroupInviteService);

  protected readonly code = toSignal(this.route.paramMap.pipe(map(p => (p.get('code') ?? '').toUpperCase())), {
    initialValue: (this.route.snapshot.paramMap.get('code') ?? '').toUpperCase()
  });

  protected readonly state = signal<ViewState>('loading');
  protected readonly preview = signal<GroupInvitePreview | null>(null);
  protected readonly sending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  protected readonly iconIsImage = computed(() => isImageIcon(this.preview()?.icon));

  constructor() {
    effect(() => this.load(this.code()));
  }

  protected sendRequest(): void {
    if (this.sending()) return;
    this.sending.set(true);
    this.sendError.set(null);
    this.invites.requestAccess(this.code()).subscribe({
      next: () => {
        this.sending.set(false);
        this.preview.update(p => (p ? { ...p, requestStatus: 'pending' } : p));
      },
      error: err => {
        this.sending.set(false);
        if (err.status === 409) {
          // Nel frattempo è diventato membro: ricarico lo stato reale.
          this.load(this.code());
          return;
        }
        this.sendError.set(err.error?.message || 'Non è stato possibile inviare la richiesta. Riprova.');
      }
    });
  }

  private load(code: string): void {
    if (!code) {
      this.state.set('invalid');
      return;
    }
    this.state.set('loading');
    this.invites.preview(code).subscribe({
      next: preview => {
        this.preview.set(preview);
        this.state.set('ready');
      },
      error: err => this.state.set(err.status === 404 ? 'invalid' : 'error')
    });
  }
}

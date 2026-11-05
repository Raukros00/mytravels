import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { PublicUser } from '../../../core/models/invite.model';
import { GroupInviteService } from '../../../core/services/group-invite.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

const MIN_QUERY = 2;

/** Campo di ricerca utenti (nome o email esatta) con risultati dal backend. */
@Component({
  selector: 'app-user-search',
  imports: [UserAvatarComponent],
  templateUrl: './user-search.component.html',
  styleUrl: './user-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserSearchComponent {
  private readonly invites = inject(GroupInviteService);

  readonly placeholder = input('Cerca per nome o email…');
  /** Utenti da non proporre (es. già membri). */
  readonly excludeIds = input<string[]>([]);
  /** Utenti già invitati: mostrati con il badge "Invitato" invece del pulsante. */
  readonly invitedIds = input<string[]>([]);
  readonly actionLabel = input('Invita');
  readonly picked = output<PublicUser>();

  protected readonly query = signal('');

  private readonly results = toSignal(
    toObservable(this.query).pipe(
      map(q => q.trim()),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => q.length < MIN_QUERY
        ? of({ q, users: [] as PublicUser[], loading: false })
        : this.invites.searchUsers(q).pipe(
            map(users => ({ q, users, loading: false })),
            catchError(() => of({ q, users: [] as PublicUser[], loading: false })),
            startWith({ q, users: [] as PublicUser[], loading: true })
          ))
    ),
    { initialValue: { q: '', users: [] as PublicUser[], loading: false } }
  );

  protected readonly tooShort = computed(() => {
    const q = this.query().trim();
    return q.length > 0 && q.length < MIN_QUERY;
  });
  protected readonly loading = computed(() => this.results().loading || this.results().q !== this.query().trim());
  protected readonly users = computed(() => {
    const exclude = new Set(this.excludeIds());
    return this.results().users.filter(u => !exclude.has(u.id));
  });
  protected readonly showDropdown = computed(() => this.query().trim().length > 0);

  protected isInvited(id: string): boolean {
    return this.invitedIds().includes(id);
  }

  protected pick(user: PublicUser): void {
    this.picked.emit(user);
    this.query.set('');
  }
}

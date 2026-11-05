import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface AvatarUser {
  name?: string;
  color?: string;
  avatar?: string;
  profileImage?: string | null;
}

/** Avatar dell'utente: foto profilo se c'è, altrimenti l'emoji scelta, altrimenti l'iniziale. */
@Component({
  selector: 'app-user-avatar',
  template: `
    @if (user()?.profileImage; as photo) {
      <img class="ua ua-photo" [src]="photo" [alt]="user()?.name || 'Foto profilo'"
        [style.width.px]="size()" [style.height.px]="size()">
    } @else {
      <span class="ua" aria-hidden="true"
        [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.48"
        [style.background-color]="user()?.color || '#ab2f0a'">{{ fallback() }}</span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
    .ua {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 9999px; color: #fff; font-weight: 700; line-height: 1;
      overflow: hidden; flex-shrink: 0;
    }
    .ua-photo { object-fit: cover; background: #eee; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserAvatarComponent {
  readonly user = input<AvatarUser | null | undefined>();
  readonly size = input(36);

  protected readonly fallback = computed(() => {
    const u = this.user();
    return u?.avatar || u?.name?.charAt(0)?.toUpperCase() || 'U';
  });
}

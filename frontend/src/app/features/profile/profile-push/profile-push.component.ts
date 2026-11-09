import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { PUSH_CATEGORIES, PushCategory, PushPreferencesService } from '../../../core/services/push-preferences.service';
import { ToastService } from '../../../core/services/toast.service';

/** Profilo → "Notifiche sul telefono": attivazione delle notifiche push su questo dispositivo. */
@Component({
  selector: 'app-profile-push',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './profile-push.component.html',
  styleUrl: './profile-push.component.css'
})
export class ProfilePushComponent {
  protected readonly push = inject(PushNotificationService);
  protected readonly prefs = inject(PushPreferencesService);
  protected readonly categories = PUSH_CATEGORIES;
  /** Chiavi di traduzione delle categorie (profile.push_pref_<chiave> e ..._desc). */
  protected readonly categoryKey: Record<PushCategory, string> = {
    invites: 'invites', proposals: 'proposals', newMembers: 'new_members', reminders: 'reminders',
  };
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  protected readonly testing = signal(false);

  constructor() {
    void this.push.refresh();
    void this.prefs.load();
  }

  /** Le preferenze per tipo valgono per l'utente: si possono cambiare anche da un dispositivo senza push. */
  protected showPreferences(): boolean {
    const state = this.push.state();
    return state !== 'loading' && state !== 'server-disabled' && this.prefs.preferences() !== null;
  }

  protected async toggleCategory(category: PushCategory): Promise<void> {
    const current = this.prefs.preferences();
    if (!current) return;
    const ok = await this.prefs.set(category, !current[category]);
    if (!ok) this.toast.error(this.translate.instant('profile.push_prefs_error'));
  }

  /** Il permesso del browser si chiede solo qui, dopo il tocco sull'interruttore. */
  protected async toggle(): Promise<void> {
    if (this.push.state() === 'on') {
      await this.push.disable();
      this.toast.info(this.translate.instant('profile.push_disabled_toast'));
      return;
    }
    const ok = await this.push.enable();
    if (ok) this.toast.success(this.translate.instant('profile.push_enabled_toast'));
    else if (this.push.state() === 'off') this.toast.error(this.translate.instant('profile.push_enable_error'));
  }

  protected async sendTest(): Promise<void> {
    if (this.testing()) return;
    this.testing.set(true);
    try {
      await this.push.sendTest();
      this.toast.success(this.translate.instant('profile.push_test_sent'));
    } catch {
      this.toast.error(this.translate.instant('profile.push_test_error'));
    } finally {
      this.testing.set(false);
    }
  }
}

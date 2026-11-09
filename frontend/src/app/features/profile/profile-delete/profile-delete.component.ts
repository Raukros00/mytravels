import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { ToastService } from '../../../core/services/toast.service';
import { Group } from '../../../core/models/group.model';

/** Gruppo citato nelle regole di eliminazione (id e nome). */
export interface GroupRef {
  id: string;
  name: string;
}

/**
 * Effetto dell'eliminazione dell'account sui gruppi (regole della #78), calcolato dai gruppi dell'utente:
 * - `blocking`: è l'unico admin di gruppi con altri membri → deve prima nominare un altro admin;
 * - `toDelete`: è l'unico membro → il gruppo e i suoi viaggi vengono eliminati.
 */
export function deletionImpact(groups: Group[], userId: string): { blocking: GroupRef[]; toDelete: GroupRef[] } {
  const blocking: GroupRef[] = [];
  const toDelete: GroupRef[] = [];
  for (const g of groups) {
    const me = g.members.find(m => m.id === userId);
    if (!me) continue;
    const others = g.members.filter(m => m.id !== userId);
    if (others.length === 0) toDelete.push({ id: g.id, name: g.name });
    else if (me.role === 'admin' && !others.some(m => m.role === 'admin')) blocking.push({ id: g.id, name: g.name });
  }
  return { blocking, toDelete };
}

/** Sezione "Zona pericolosa" del Profilo (#121): scarica i miei dati ed elimina account. */
@Component({
  selector: 'app-profile-delete',
  imports: [TranslatePipe, ModalComponent, RouterLink],
  templateUrl: './profile-delete.component.html',
  styleUrl: './profile-delete.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileDeleteComponent {
  private readonly authService = inject(AuthService);
  private readonly groupService = inject(GroupService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Gruppi bloccanti restituiti dal server (409), se diversi da quelli calcolati qui. */
  private readonly serverBlocking = signal<GroupRef[] | null>(null);
  protected readonly exporting = signal(false);

  /** Tutti i gruppi dell'utente, anche archiviati: le regole valgono per tutti. */
  private readonly impact = computed(() => {
    const me = this.authService.currentUser();
    return me ? deletionImpact(this.groupService.allUserGroups(), me.id) : { blocking: [], toDelete: [] };
  });
  protected readonly blocking = computed(() => this.serverBlocking() ?? this.impact().blocking);
  protected readonly toDelete = computed(() => this.impact().toDelete);

  protected openModal(): void {
    this.password.set('');
    this.showPassword.set(false);
    this.error.set(null);
    this.serverBlocking.set(null);
    this.pending.set(false);
    // Dati aggiornati dei gruppi (ruoli e membri possono essere cambiati da altri).
    this.groupService.loadGroups();
    this.open.set(true);
  }

  protected close(): void {
    if (this.pending()) return;
    this.open.set(false);
  }

  protected onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  protected confirm(): void {
    if (!this.password() || this.pending() || this.blocking().length) return;
    this.pending.set(true);
    this.error.set(null);
    this.authService.deleteAccount(this.password()).subscribe({
      next: () => {
        this.pending.set(false);
        this.open.set(false);
        this.toast.success(this.translate.instant('profile.delete_done'));
        this.router.navigate(['/explore']);
      },
      error: err => {
        this.pending.set(false);
        if (err?.status === 409 && Array.isArray(err.error?.groups)) {
          this.serverBlocking.set(err.error.groups);
        } else {
          this.error.set(this.translate.instant(
            err?.status === 401 ? 'profile.delete_wrong_password'
              : err?.status === 429 ? 'profile.delete_too_many'
              : 'profile.delete_error'
          ));
        }
      }
    });
  }

  /** Scarica i dati personali come file JSON. */
  protected exportData(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.authService.exportMyData().subscribe({
      next: blob => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'wanderbite-dati.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.exporting.set(false);
        this.toast.error(this.translate.instant('profile.export_error'));
      }
    });
  }
}

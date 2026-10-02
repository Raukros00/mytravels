import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-group-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalComponent, TranslatePipe],
  templateUrl: './group-settings.component.html',
  styleUrl: './group-settings.component.css'
})
export class GroupSettingsComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  public groupService = inject(GroupService);

  private groupId = toSignal(this.route.paramMap.pipe(map(p => p.get('id') ?? '')));

  public readonly currencies = [
    { code: 'EUR', label: 'Euro (€)' },
    { code: 'USD', label: 'Dollaro USA ($)' },
    { code: 'GBP', label: 'Sterlina (£)' },
    { code: 'CHF', label: 'Franco svizzero (CHF)' },
    { code: 'JPY', label: 'Yen (¥)' },
    { code: 'CAD', label: 'Dollaro canadese (CA$)' },
    { code: 'AUD', label: 'Dollaro australiano (A$)' }
  ];

  public group = computed(() =>
    this.groupService.allUserGroups().find(g => g.id === this.groupId()) ?? null
  );

  public isMuted = computed(() => this.groupService.isMuted(this.group()));

  public isCreator = computed(() =>
    !!this.group() && this.group()!.creatorId === this.authService.currentUser()?.id
  );

  public isAdmin = computed(() => {
    const g = this.group();
    const me = this.authService.currentUser();
    return !!g && !!me && g.members.find(m => m.id === me.id)?.role === 'admin';
  });

  public deleteConfirmVisible = signal(false);
  public deleteConfirmInput = signal('');

  toggleMute(): void {
    const g = this.group();
    if (!g) return;
    const muted = !this.isMuted();
    this.groupService.setMuted(g.id, muted);
    this.toastService.success(muted ? 'Gruppo silenziato.' : 'Notifiche del gruppo riattivate.');
  }

  onCurrencyChange(event: Event): void {
    const g = this.group();
    if (!g) return;
    this.groupService.setCurrency(g.id, (event.target as HTMLSelectElement).value);
  }

  toggleArchive(): void {
    const g = this.group();
    if (!g) return;
    const archived = !g.archived;
    this.groupService.setArchived(g.id, archived);
    this.toastService.success(archived ? 'Gruppo archiviato.' : 'Gruppo ripristinato.');
  }

  openDeleteConfirm(): void {
    this.deleteConfirmInput.set('');
    this.deleteConfirmVisible.set(true);
  }

  deleteGroup(): void {
    const g = this.group();
    if (!g) return;
    this.groupService.deleteGroup(g.id);
    this.deleteConfirmVisible.set(false);
    this.router.navigate(['/groups']);
  }
}

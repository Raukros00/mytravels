import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { GroupService } from '../../../core/services/group.service';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { GroupCreateModalComponent } from '../group-create-modal/group-create-modal.component';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalComponent, GroupCreateModalComponent, TranslatePipe],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css'
})
export class GroupDetailComponent implements AfterViewInit, OnDestroy {
  @ViewChild('heroIcon') heroIconRef!: ElementRef<HTMLElement>;
  private resizeObserver?: ResizeObserver;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public authService = inject(AuthService);
  public groupService = inject(GroupService);
  private tripService = inject(TripService);
  private toastService = inject(ToastService);
  private notificationService = inject(NotificationService);

  private groupId = toSignal(this.route.paramMap.pipe(map(p => p.get('id') ?? '')));

  public group = computed(() =>
    this.groupService.userGroups().find(g => g.id === this.groupId()) ?? null
  );

  public groupTrips = computed(() =>
    this.tripService.trips().filter(t => t.groupId === this.groupId())
  );

  public codeVisible = signal(false);
  public isEditModalOpen = signal(false);
  public deleteConfirmVisible = signal(false);
  public leaveConfirmVisible = signal(false);
  public shareModalVisible = signal(false);
  public activeMemberMenu = signal<string | null>(null);
  public menuDirection = signal<'up' | 'down'>('down');
  public customMessage = signal('');
  public membersModalVisible = signal(false);
  public inviteSearch = signal('');
  public invitedThisSession = signal<string[]>([]);

  public pendingGroupInvites = computed(() => {
    const g = this.group();
    if (!g) return [];
    const users = this.authService.platformUsers();
    const seen = new Set<string>();
    return this.notificationService.allNotifications()
      .filter(n => n.groupId === g.id && n.status === 'pending')
      .filter(n => {
        if (seen.has(n.recipientId)) return false;
        seen.add(n.recipientId);
        return true;
      })
      .map(n => {
        const user = users.find(u => u.id === n.recipientId);
        return {
          notifId: n.id,
          recipientId: n.recipientId,
          name: user?.name ?? 'Utente',
          avatar: user?.avatar ?? '👤',
          color: user?.color ?? '#9ca3af'
        };
      });
  });

  public pendingRecipientIds = computed(() =>
    new Set(this.pendingGroupInvites().map(p => p.recipientId))
  );

  public invitedThisSessionUsers = computed(() => {
    const ids = this.invitedThisSession();
    return this.authService.platformUsers().filter(u => ids.includes(u.id));
  });

  public searchResults = computed(() => {
    const q = this.inviteSearch().toLowerCase().trim();
    const g = this.group();
    const me = this.authService.currentUser();
    const memberIds = new Set(g?.members.map(m => m.id) ?? []);
    return this.authService.platformUsers()
      .filter(u => u.id !== me?.id && !memberIds.has(u.id))
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  public isCreator = computed(() =>
    !!this.group() && this.group()!.creatorId === this.authService.currentUser()?.id
  );

  public isCurrentUserAdmin = computed(() => {
    const g = this.group();
    const me = this.authService.currentUser();
    if (!g || !me) return false;
    return g.members.find(m => m.id === me.id)?.role === 'admin';
  });

  public groupCreator = computed(() => {
    const g = this.group();
    if (!g) return null;
    return this.authService.platformUsers().find(u => u.id === g.creatorId) ?? null;
  });

  deleteGroup(): void {
    const g = this.group();
    if (!g) return;
    this.groupService.deleteGroup(g.id);
    this.deleteConfirmVisible.set(false);
    this.toastService.success(`Gruppo "${g.name}" eliminato.`);
    this.router.navigate(['/groups']);
  }

  copyCode(): void {
    const code = this.group()?.inviteCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    this.toastService.success(`Codice ${code} copiato negli appunti! 📋`);
  }

  openShareModal(): void {
    const g = this.group();
    if (!g) return;
    const link = window.location.origin;
    this.customMessage.set(
      `Unisciti al gruppo "${g.name}" su WanderBite! 🌍\nUsa il codice invito: ${g.inviteCode}\n👉 ${link}`
    );
    this.inviteSearch.set('');
    this.invitedThisSession.set([]);
    this.shareModalVisible.set(true);
  }

  onShareModalClose(): void {
    this.shareModalVisible.set(false);
    this.codeVisible.set(false);
    this.inviteSearch.set('');
    this.invitedThisSession.set([]);
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

  makeAdmin(memberId: string): void {
    const g = this.group();
    if (!g) return;
    this.groupService.setMemberRole(g.id, memberId, 'admin');
  }

  removeAdmin(memberId: string): void {
    const g = this.group();
    if (!g) return;
    this.groupService.setMemberRole(g.id, memberId, 'member');
  }

  revokeInvite(notifId: string): void {
    this.notificationService.revokeInvite(notifId);
  }

  removeMemberFromGroup(memberId: string): void {
    const g = this.group();
    if (!g) return;
    this.groupService.removeMember(g.id, memberId);
  }

  openLeaveConfirm(): void {
    const g = this.group();
    const user = this.authService.currentUser();
    if (!g || !user) return;
    const isAdmin = g.members.find(m => m.id === user.id)?.role === 'admin';
    if (isAdmin) {
      const otherAdmins = g.members.filter(m => m.id !== user.id && m.role === 'admin');
      if (otherAdmins.length === 0) {
        this.toastService.error('Non puoi uscire dal gruppo finché non assegni un altro admin.');
        return;
      }
    }
    this.membersModalVisible.set(false);
    this.leaveConfirmVisible.set(true);
  }

  leaveGroup(): void {
    const g = this.group();
    const user = this.authService.currentUser();
    if (!g || !user) return;
    this.leaveConfirmVisible.set(false);
    this.groupService.removeMember(g.id, user.id);
    this.router.navigate(['/groups']);
  }

  ngAfterViewInit(): void {
    const el = this.heroIconRef?.nativeElement;
    if (!el) return;
    this.syncIconWidth(el);
    this.resizeObserver = new ResizeObserver(() => this.syncIconWidth(el));
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private syncIconWidth(el: HTMLElement): void {
    el.style.width = el.offsetHeight + 'px';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Element).closest('.member-menu-wrap')) {
      this.activeMemberMenu.set(null);
    }
  }

  toggleMemberMenu(memberId: string, event?: MouseEvent): void {
    if (this.activeMemberMenu() === memberId) {
      this.activeMemberMenu.set(null);
      return;
    }
    if (event) {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.menuDirection.set(window.innerHeight - rect.bottom < 150 ? 'up' : 'down');
    }
    this.activeMemberMenu.set(memberId);
  }

  createTrip(): void {
    this.router.navigate(['/trips', 'new'], { queryParams: { groupId: this.groupId() } });
  }

  isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

}

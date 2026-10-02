import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Trip, TripStatus, deriveTripStatus, isProposal } from '../../../core/models/trip.model';
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
    this.groupService.allUserGroups().find(g => g.id === this.groupId()) ?? null
  );

  private allGroupTrips = computed(() =>
    this.tripService.trips().filter(t => t.groupId === this.groupId())
  );

  /** Ongoing first, then upcoming (soonest first), completed last (most recent first). */
  public groupTrips = computed(() => {
    const rank: Record<TripStatus, number> = { ongoing: 0, planning: 1, upcoming: 1, completed: 2 };
    return this.allGroupTrips()
      .filter(t => !isProposal(t))
      .sort((a, b) => {
        const sa = deriveTripStatus(a), sb = deriveTripStatus(b);
        if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
        return sa === 'completed'
          ? b.endDate.localeCompare(a.endDate)
          : a.startDate.localeCompare(b.startDate);
      });
  });
  private readonly tripsPreviewCount = 3;
  private readonly tripsPageSize = 4;
  public tripsExpanded = signal(false);
  private tripsLoaded = signal(this.tripsPreviewCount);

  public visibleTrips = computed(() =>
    this.groupTrips().slice(0, this.tripsExpanded() ? this.tripsLoaded() : this.tripsPreviewCount)
  );
  public canExpandTrips = computed(() => this.groupTrips().length > this.tripsPreviewCount);
  public hasMoreTrips = computed(() => this.tripsExpanded() && this.tripsLoaded() < this.groupTrips().length);

  expandTrips(): void {
    this.tripsLoaded.set(this.tripsPreviewCount + this.tripsPageSize);
    this.tripsExpanded.set(true);
  }

  collapseTrips(scroller: HTMLElement): void {
    this.tripsExpanded.set(false);
    scroller.scrollTop = 0;
  }

  /** Infinite scroll: load the next page when the user nears the bottom of the list. */
  onTripsScroll(event: Event): void {
    if (!this.hasMoreTrips()) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      this.tripsLoaded.update(n => n + this.tripsPageSize);
    }
  }

  public groupProposals = computed(() => this.allGroupTrips().filter(t => isProposal(t)));

  public codeVisible = signal(false);
  public isEditModalOpen = signal(false);
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

  tripStatus(trip: Trip): TripStatus {
    return deriveTripStatus(trip);
  }

  private daysBetween(from: string, to: string): number {
    return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  }

  /** Extra line shown on the card depending on the trip status. */
  tripStatusNote(trip: Trip): { key: string; params: Record<string, number>; progress?: number } {
    const today = new Date().toISOString().split('T')[0];
    switch (deriveTripStatus(trip)) {
      case 'ongoing': {
        const day = this.daysBetween(trip.startDate, today) + 1;
        const total = this.tripDays(trip);
        return { key: 'groups.trip_note_ongoing', params: { day, total }, progress: (day / total) * 100 };
      }
      case 'completed':
        return { key: 'groups.trip_note_completed', params: { days: this.daysBetween(trip.endDate, today) } };
      default: {
        const days = this.daysBetween(today, trip.startDate);
        return { key: days === 1 ? 'groups.trip_note_tomorrow' : 'groups.trip_note_upcoming', params: { days } };
      }
    }
  }

  tripStatusIcon(status: TripStatus): string {
    return { planning: 'edit_note', upcoming: 'schedule', ongoing: 'timelapse', completed: 'check_circle' }[status];
  }

  proposerName(trip: Trip): string {
    return this.group()?.members.find(m => m.id === trip.proposedBy)?.name ?? '';
  }

  votes(trip: Trip): number {
    return this.tripService.validVotes(trip).length;
  }

  votesNeeded(trip: Trip): number {
    return this.tripService.votesNeeded(trip);
  }

  hasVoted(trip: Trip): boolean {
    const me = this.authService.currentUser();
    return !!me && this.tripService.validVotes(trip).includes(me.id);
  }

  toggleVote(trip: Trip): void {
    this.tripService.toggleVote(trip.id);
  }

  tripDays(trip: Trip): number {
    const ms = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    return Math.round(ms / 86400000) + 1;
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

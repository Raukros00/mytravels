import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TripStatus, deriveTripStatus, isProposal } from '../../../core/models/trip.model';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { GroupCreateModalComponent } from '../group-create-modal/group-create-modal.component';
import { GroupHeroComponent } from './components/group-hero/group-hero.component';
import { GroupTripsComponent } from './components/group-trips/group-trips.component';
import { GroupMembersListComponent } from './components/group-members-list/group-members-list.component';
import { GroupMembersModalComponent } from './components/group-members-modal/group-members-modal.component';
import { GroupShareModalComponent } from './components/group-share-modal/group-share-modal.component';

@Component({
  selector: 'app-group-detail',
  imports: [
    RouterLink,
    ModalComponent,
    GroupCreateModalComponent,
    TranslatePipe,
    GroupHeroComponent,
    GroupTripsComponent,
    GroupMembersListComponent,
    GroupMembersModalComponent,
    GroupShareModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css'
})
export class GroupDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly groupService = inject(GroupService);
  private readonly tripService = inject(TripService);
  private readonly toastService = inject(ToastService);

  private readonly groupId = toSignal(this.route.paramMap.pipe(map(p => p.get('id') ?? '')), { initialValue: '' });

  readonly group = computed(() =>
    this.groupService.allUserGroups().find(g => g.id === this.groupId()) ?? null
  );

  private readonly allGroupTrips = computed(() =>
    this.tripService.trips().filter(t => t.groupId === this.groupId())
  );

  /** Ongoing first, then upcoming (soonest first), completed last (most recent first). */
  readonly groupTrips = computed(() => {
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

  readonly groupProposals = computed(() => this.allGroupTrips().filter(t => isProposal(t)));

  readonly isEditModalOpen = signal(false);
  readonly leaveConfirmVisible = signal(false);
  readonly shareModalVisible = signal(false);
  readonly membersModalVisible = signal(false);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  readonly isCurrentUserAdmin = computed(() => {
    const g = this.group();
    const me = this.currentUserId();
    if (!g || !me) return false;
    return g.members.find(m => m.id === me)?.role === 'admin';
  });

  readonly groupCreator = computed(() => {
    const g = this.group();
    if (!g) return null;
    return this.authService.platformUsers().find(u => u.id === g.creatorId) ?? null;
  });

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
}

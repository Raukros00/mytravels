import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Group } from '../../../core/models/group.model';
import { TripTemplate } from '../../../core/models/trip-template.model';
import { ExploreService } from '../../../core/services/explore.service';
import { GroupService } from '../../../core/services/group.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { daysLabel, formatDateIt } from '../explore.utils';
import { addDaysIso, todayIso } from '../../../core/utils/date.utils';

@Component({
  selector: 'app-explore-assign-modal',
  imports: [FormsModule, RouterLink, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore-assign-modal.component.html',
  styleUrl: './explore-assign-modal.component.css'
})
export class ExploreAssignModalComponent {
  readonly isOpen = input(false);
  readonly template = input.required<TripTemplate>();
  readonly closed = output<void>();

  protected readonly groupService = inject(GroupService);
  private exploreService = inject(ExploreService);
  private router = inject(Router);

  protected readonly selectedGroupId = signal<string | null>(null);
  protected readonly startDate = signal('');
  protected readonly today = todayIso();

  protected readonly endDate = computed(() => {
    const start = this.startDate();
    if (!start) return '';
    return addDaysIso(start, this.template().durationDays - 1);
  });

  protected readonly canConfirm = computed(() => !!this.selectedGroupId() && !!this.startDate());

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      untracked(() => {
        const groups = this.groupService.userGroups();
        const active = this.groupService.activeGroup();
        this.selectedGroupId.set(groups.find(g => g.id === active?.id)?.id ?? groups[0]?.id ?? null);
        this.startDate.set(addDaysIso(todayIso(), 14));
      });
    });
  }

  protected isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

  protected membersLabel(group: Group): string {
    return group.members.length === 1 ? '1 membro' : `${group.members.length} membri`;
  }

  protected readonly daysLabel = daysLabel;
  protected readonly formatDateIt = formatDateIt;

  protected confirm(): void {
    const groupId = this.selectedGroupId();
    if (!groupId || !this.startDate()) return;
    const trip = this.exploreService.assignToGroup(this.template().id, groupId, this.startDate());
    if (!trip) return;
    this.closed.emit();
    this.router.navigate(['/trips', trip.id]);
  }
}

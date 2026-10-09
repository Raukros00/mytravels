import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { GroupMember } from '../../../../../core/models/group.model';
import { GroupService } from '../../../../../core/services/group.service';

@Component({
  selector: 'app-group-members-list',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)' },
  templateUrl: './group-members-list.component.html',
  styleUrl: './group-members-list.component.css'
})
export class GroupMembersListComponent {
  private readonly groupService = inject(GroupService);

  readonly groupId = input.required<string>();
  readonly members = input.required<GroupMember[]>();
  readonly currentUserId = input<string | undefined>(undefined);
  readonly isAdmin = input(false);
  /** 'card' = compact list in the page, 'modal' = full list inside the members modal. */
  readonly variant = input<'card' | 'modal'>('card');
  readonly limit = input<number | null>(null);

  readonly leave = output<void>();

  readonly visibleMembers = computed(() => {
    const limit = this.limit();
    return limit === null ? this.members() : this.members().slice(0, limit);
  });

  readonly activeMenu = signal<string | null>(null);
  readonly menuDirection = signal<'up' | 'down'>('down');

  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Element).closest('.member-menu-wrap')) {
      this.activeMenu.set(null);
    }
  }

  toggleMenu(memberId: string, event: MouseEvent): void {
    if (this.activeMenu() === memberId) {
      this.activeMenu.set(null);
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.menuDirection.set(window.innerHeight - rect.bottom < 150 ? 'up' : 'down');
    this.activeMenu.set(memberId);
  }

  setRole(memberId: string, role: 'admin' | 'member'): void {
    this.groupService.setMemberRole(this.groupId(), memberId, role);
    this.activeMenu.set(null);
  }

  remove(memberId: string): void {
    this.groupService.removeMember(this.groupId(), memberId);
  }
}

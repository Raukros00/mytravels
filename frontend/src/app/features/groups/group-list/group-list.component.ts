import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GroupService } from '../../../core/services/group.service';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../core/services/toast.service';
import { GroupCreateModalComponent } from '../group-create-modal/group-create-modal.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    GroupCreateModalComponent, 
    ModalComponent, 
    EmptyStateComponent
  ],
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.css'
})
export class GroupListComponent {
  public groupService = inject(GroupService);
  public tripService = inject(TripService);
  private toastService = inject(ToastService);

  public isCreateModalOpen = signal(false);
  public isJoinModalOpen = signal(false);
  public inviteCodeInput = '';

  selectActiveGroup(groupId: string): void {
    this.groupService.setActiveGroup(groupId);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
    this.toastService.success(`Codice ${code} copiato negli appunti! 📋`);
  }

  onJoinGroup(): void {
    if (!this.inviteCodeInput.trim()) return;

    const success = this.groupService.joinGroupByCode(this.inviteCodeInput);
    if (success) {
      this.inviteCodeInput = '';
      this.isJoinModalOpen.set(false);
    }
  }
}

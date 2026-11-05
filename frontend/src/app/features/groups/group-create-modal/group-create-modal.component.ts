import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { GroupService } from '../../../core/services/group.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Group } from '../../../core/models/group.model';
import { PublicUser } from '../../../core/models/invite.model';
import { ToastService } from '../../../core/services/toast.service';
import { GroupIconPickerComponent } from './components/group-icon-picker/group-icon-picker.component';
import { GroupInvitePickerComponent } from './components/group-invite-picker/group-invite-picker.component';

@Component({
  selector: 'app-group-create-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent, TranslatePipe, GroupIconPickerComponent, GroupInvitePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-create-modal.component.html',
  styleUrl: './group-create-modal.component.css'
})
export class GroupCreateModalComponent {
  readonly isOpen = input(false);
  readonly group = input<Group | null>(null);
  readonly closeModal = output<void>();

  private readonly iconPicker = viewChild(GroupIconPickerComponent);

  private readonly fb = inject(FormBuilder);
  private readonly groupService = inject(GroupService);
  private readonly notificationService = inject(NotificationService);
  private readonly toastService = inject(ToastService);

  readonly isEditMode = computed(() => !!this.group());

  readonly icon = signal('');
  readonly invitedUsers = signal<PublicUser[]>([]);

  readonly groupForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['']
  });

  constructor() {
    effect(() => {
      if (!this.isOpen()) return;
      const g = this.group();
      untracked(() => {
        if (g) {
          this.icon.set(g.icon);
          this.groupForm.patchValue({ name: g.name, description: g.description });
        } else {
          this.icon.set('');
          this.groupForm.reset({ name: '', description: '' });
        }
        this.iconPicker()?.reset();
        this.invitedUsers.set([]);
      });
    });
  }


  onClose(): void {
    this.icon.set('');
    this.iconPicker()?.reset();
    this.invitedUsers.set([]);
    this.groupForm.reset({ name: '', description: '' });
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.groupForm.invalid) return;
    const val = this.groupForm.value;
    const icon = this.icon() || '✈️';
    const group = this.group();
    const invited = this.invitedUsers();

    if (group) {
      this.groupService.updateGroup(group.id, {
        name: val.name!,
        description: val.description || '',
        icon,
        color: group.color
      });
      this.sendInvites(group.id, invited);
    } else {
      // Gli inviti partono quando il backend ha salvato il gruppo: serve il suo id definitivo.
      this.groupService.createGroup(
        { name: val.name!, description: val.description || '', icon, color: '#4f46e5' },
        created => this.sendInvites(created.id, invited)
      );
    }

    this.onClose();
  }

  private sendInvites(groupId: string, users: PublicUser[]): void {
    users.forEach(user =>
      this.notificationService.sendGroupInvite(user.id, groupId).subscribe({
        error: err => this.toastService.error(err.error?.message || `Non è stato possibile invitare ${user.name}.`)
      })
    );
    if (users.length > 0) {
      this.toastService.success(users.length === 1 ? `Invito inviato a ${users[0].name}.` : `${users.length} inviti inviati.`);
    }
  }
}

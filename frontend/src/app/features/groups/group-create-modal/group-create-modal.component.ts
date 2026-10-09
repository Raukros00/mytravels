import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { GroupService } from '../../../core/services/group.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Group } from '../../../core/models/group.model';
import { GroupIconPickerComponent } from './components/group-icon-picker/group-icon-picker.component';
import { GroupInvitePickerComponent } from './components/group-invite-picker/group-invite-picker.component';

@Component({
  selector: 'app-group-create-modal',
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
  private readonly authService = inject(AuthService);

  readonly isEditMode = computed(() => !!this.group());

  readonly icon = signal('');
  readonly inviteSearch = signal('');
  readonly invitedUsers = signal<string[]>([]);

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
        this.inviteSearch.set('');
        this.invitedUsers.set([]);
      });
    });
  }

  private isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

  onClose(): void {
    this.icon.set('');
    this.iconPicker()?.reset();
    this.inviteSearch.set('');
    this.invitedUsers.set([]);
    this.groupForm.reset({ name: '', description: '' });
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.groupForm.invalid) return;
    const val = this.groupForm.value;
    const me = this.authService.currentUser();
    const icon = this.icon() || '✈️';
    const safeIcon = this.isImageIcon(icon) ? '🌍' : icon;
    const group = this.group();

    let groupId: string;
    let groupName: string;
    let groupColor: string;

    if (group) {
      this.groupService.updateGroup(group.id, {
        name: val.name!,
        description: val.description || '',
        icon,
        color: group.color
      });
      groupId = group.id;
      groupName = val.name!;
      groupColor = group.color;
    } else {
      const newGroup = this.groupService.createGroup({
        name: val.name!,
        description: val.description || '',
        icon,
        color: '#4f46e5'
      });
      groupId = newGroup.id;
      groupName = newGroup.name;
      groupColor = newGroup.color;
    }

    const invitedIds = this.invitedUsers();
    if (invitedIds.length > 0 && me) {
      const notifGroup = { id: groupId, name: groupName, icon: safeIcon, color: groupColor };
      invitedIds.forEach(userId =>
        this.notificationService.sendGroupInvite(userId, me.name, notifGroup)
      );
    }

    this.onClose();
  }
}

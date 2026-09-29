import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { GroupService } from '../../../core/services/group.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Group } from '../../../core/models/group.model';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-group-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalComponent, TranslatePipe],
  templateUrl: './group-create-modal.component.html',
  styleUrl: './group-create-modal.component.css'
})
export class GroupCreateModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() group: Group | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  get isEditMode(): boolean { return !!this.group; }

  public emojiPresets = ['✈️', '🍕', '🍜', '🍷', '🏖️', '🎒', '🏰', '🍣', '🍦', '☕', '🏕️', '🌮', '🍸', '🏔️', '🚂', '🥐'];

  // Icon picker
  public imagePreview = signal<string | null>(null);
  public hasSelectedEmoji = signal(false);
  public showEmojiPicker = signal(false);
  public showThumbMenu = signal(false);

  // Invite section
  private groupSignal = signal<Group | null>(null);
  public inviteSearch = signal('');
  public invitedUsers = signal<string[]>([]);

  public pendingRecipientIds = computed(() => {
    const g = this.groupSignal();
    if (!g) return new Set<string>();
    return new Set(
      this.notificationService.allNotifications()
        .filter(n => n.groupId === g.id && n.status === 'pending')
        .map(n => n.recipientId)
    );
  });

  public searchResults = computed(() => {
    const q = this.inviteSearch().toLowerCase().trim();
    if (!q) return [];
    const me = this.authService.currentUser();
    const g = this.groupSignal();
    const memberIds = new Set(g?.members.map(m => m.id) ?? []);
    const invitedIds = new Set(this.invitedUsers());
    return this.authService.platformUsers()
      .filter(u => u.id !== me?.id && !memberIds.has(u.id) && !invitedIds.has(u.id))
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  public invitedUserDetails = computed(() => {
    const ids = this.invitedUsers();
    return this.authService.platformUsers().filter(u => ids.includes(u.id));
  });

  public groupForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    icon: ['']
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.groupSignal.set(this.group);
      if (this.group) {
        const isImage = this.isImageIcon(this.group.icon);
        this.imagePreview.set(isImage ? this.group.icon : null);
        this.hasSelectedEmoji.set(!isImage);
        this.groupForm.patchValue({ name: this.group.name, description: this.group.description, icon: this.group.icon });
      } else {
        this.imagePreview.set(null);
        this.hasSelectedEmoji.set(false);
        this.groupForm.reset({ name: '', description: '', icon: '' });
      }
      this.showEmojiPicker.set(false);
      this.showThumbMenu.set(false);
      this.inviteSearch.set('');
      this.invitedUsers.set([]);
    }
  }

  isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

  toggleThumbMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showThumbMenu.update(v => !v);
  }

  @HostListener('document:click')
  closeThumbMenu(): void {
    this.showThumbMenu.set(false);
  }

  onPickGallery(): void {
    this.showEmojiPicker.set(false);
    this.showThumbMenu.set(false);
    this.fileInputRef.nativeElement.click();
  }

  onPickEmoji(): void {
    this.showThumbMenu.set(false);
    this.showEmojiPicker.update(v => !v);
  }

  selectEmoji(emoji: string): void {
    this.imagePreview.set(null);
    this.hasSelectedEmoji.set(true);
    this.groupForm.patchValue({ icon: emoji });
    this.showEmojiPicker.set(false);
  }

  clearIcon(): void {
    this.imagePreview.set(null);
    this.hasSelectedEmoji.set(false);
    this.groupForm.patchValue({ icon: '' });
    this.showEmojiPicker.set(false);
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  onImageChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = new Image();
      raw.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 240;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const aspect = raw.width / raw.height;
        let sx = 0, sy = 0, sw = raw.width, sh = raw.height;
        if (aspect > 1) { sx = (raw.width - raw.height) / 2; sw = raw.height; }
        else { sy = (raw.height - raw.width) / 2; sh = raw.width; }
        ctx.drawImage(raw, sx, sy, sw, sh, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        this.imagePreview.set(dataUrl);
        this.groupForm.patchValue({ icon: dataUrl });
      };
      raw.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  inviteUser(user: User): void {
    this.invitedUsers.update(ids => [...ids, user.id]);
    this.inviteSearch.set('');
  }

  removeInvite(userId: string): void {
    this.invitedUsers.update(ids => ids.filter(id => id !== userId));
  }

  onClose(): void {
    this.imagePreview.set(null);
    this.hasSelectedEmoji.set(false);
    this.showEmojiPicker.set(false);
    this.showThumbMenu.set(false);
    this.inviteSearch.set('');
    this.invitedUsers.set([]);
    this.groupForm.reset({ name: '', description: '', icon: '' });
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.groupForm.invalid) return;
    const val = this.groupForm.value;
    const me = this.authService.currentUser();
    const icon = val.icon || '✈️';
    const safeIcon = this.isImageIcon(icon) ? '🌍' : icon;

    let groupId: string;
    let groupName: string;
    let groupColor: string;

    if (this.isEditMode && this.group) {
      this.groupService.updateGroup(this.group.id, {
        name: val.name!,
        description: val.description || '',
        icon,
        color: this.group.color
      });
      groupId = this.group.id;
      groupName = val.name!;
      groupColor = this.group.color;
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

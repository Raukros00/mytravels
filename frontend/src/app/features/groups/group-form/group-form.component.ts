import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { GroupService } from '../../../core/services/group.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-group-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './group-form.component.html',
  styleUrl: './group-form.component.css'
})
export class GroupFormComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  private groupId = toSignal(this.route.paramMap.pipe(map(p => p.get('id'))));

  public group = computed(() => {
    const id = this.groupId();
    if (!id) return null;
    return this.groupService.allUserGroups().find(g => g.id === id) ?? null;
  });

  get isEditMode(): boolean { return !!this.groupId(); }

  public emojiPresets = ['✈️', '🍕', '🍜', '🍷', '🏖️', '🎒', '🏰', '🍣', '🍦', '☕', '🏕️', '🌮', '🍸', '🏔️', '🚂', '🥐'];

  public imagePreview = signal<string | null>(null);
  public hasSelectedEmoji = signal(false);
  public showEmojiPicker = signal(false);
  public inviteSearch = signal('');
  public invitedUsers = signal<string[]>([]);

  public searchResults = computed(() => {
    const q = this.inviteSearch().toLowerCase().trim();
    if (!q) return [];
    const me = this.authService.currentUser();
    const g = this.group();
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

  public pendingRecipientIds = computed(() => {
    const g = this.group();
    if (!g) return new Set<string>();
    return new Set(
      this.notificationService.allNotifications()
        .filter(n => n.groupId === g.id && n.status === 'pending')
        .map(n => n.recipientId)
    );
  });

  public groupForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    icon: ['']
  });

  ngOnInit(): void {
    const g = this.group();
    if (g) {
      const isImage = this.isImageIcon(g.icon);
      this.imagePreview.set(isImage ? g.icon : null);
      this.hasSelectedEmoji.set(!isImage && !!g.icon);
      this.groupForm.patchValue({ name: g.name, description: g.description, icon: g.icon });
    }
  }

  isImageIcon(icon: string): boolean {
    return icon.startsWith('data:') || icon.startsWith('http') || icon.startsWith('blob:');
  }

  onPickGallery(): void {
    this.showEmojiPicker.set(false);
    this.fileInputRef.nativeElement.click();
  }

  onPickEmoji(): void {
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
      const dataUrl = reader.result as string;
      this.imagePreview.set(dataUrl);
      this.hasSelectedEmoji.set(false);
      this.groupForm.patchValue({ icon: dataUrl });
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

  onCancel(): void {
    const g = this.group();
    this.router.navigate(g ? ['/groups', g.id] : ['/groups']);
  }

  onSubmit(): void {
    if (this.groupForm.invalid) return;
    const val = this.groupForm.value;
    const me = this.authService.currentUser();
    const icon = val.icon || '✈️';
    const safeIcon = this.isImageIcon(icon) ? '🌍' : icon;
    const g = this.group();

    let groupId: string;
    let groupName: string;
    let groupColor: string;

    if (this.isEditMode && g) {
      this.groupService.updateGroup(g.id, {
        name: val.name!,
        description: val.description || '',
        icon,
        color: g.color
      });
      groupId = g.id;
      groupName = val.name!;
      groupColor = g.color;
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

    this.router.navigate(['/groups', groupId]);
  }
}

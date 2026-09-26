import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GroupService } from '../../../core/services/group.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { TripService } from '../../../core/services/trip.service';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css'
})
export class GroupDetailComponent {
  private fb = inject(FormBuilder);
  public groupService = inject(GroupService);
  public authService = inject(AuthService);
  public tripService = inject(TripService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  public isEditing = signal(false);
  public showDeleteConfirm = signal(false);

  public emojiPresets = ['✈️', '🍕', '🍜', '🍷', '🏖️', '🎒', '🏰', '🍣', '🍦', '☕', '🏕️', '🌮', '🍸', '🏔️', '🚂', '🥐'];
  public colorPresets = ['#AB2F0A', '#2D6A4F', '#B45309', '#2563EB', '#7C3AED', '#0D9488', '#DC2626'];

  public group = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.groupService.getGroupById(id) : undefined;
  });

  public groupTrips = computed(() => {
    const g = this.group();
    if (!g) return [];
    return this.tripService.trips().filter(t => t.groupId === g.id);
  });

  public isCurrentUserAdmin = computed(() => {
    const user = this.authService.currentUser();
    const g = this.group();
    if (!user || !g) return false;
    const me = g.members.find(m => m.id === user.id);
    return me?.role === 'admin' || g.creatorId === user.id;
  });

  public editForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    icon: ['', Validators.required],
    color: ['', Validators.required]
  });

  startEdit(): void {
    const g = this.group();
    if (!g) return;
    this.editForm.patchValue({ name: g.name, description: g.description, icon: g.icon, color: g.color });
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveEdit(): void {
    if (this.editForm.invalid) return;
    const g = this.group();
    if (!g) return;
    const val = this.editForm.value;
    this.groupService.updateGroup(g.id, {
      name: val.name!,
      description: val.description || '',
      icon: val.icon!,
      color: val.color!
    });
    this.isEditing.set(false);
  }

  removeMember(memberId: string): void {
    const g = this.group();
    if (!g) return;
    this.groupService.removeMember(g.id, memberId);
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
    this.toastService.success('Codice copiato! 📋');
  }

  confirmDelete(): void {
    this.showDeleteConfirm.set(true);
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
  }

  deleteGroup(): void {
    const g = this.group();
    if (!g) return;
    this.groupService.deleteGroup(g.id);
    this.router.navigate(['/groups']);
  }
}

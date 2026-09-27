import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { GroupService } from '../../../core/services/group.service';
import { TripService } from '../../../core/services/trip.service';
import { ToastService } from '../../../core/services/toast.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalComponent],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css'
})
export class GroupDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public authService = inject(AuthService);
  public groupService = inject(GroupService);
  private tripService = inject(TripService);
  private toastService = inject(ToastService);

  private groupId = toSignal(this.route.paramMap.pipe(map(p => p.get('id') ?? '')));

  public group = computed(() =>
    this.groupService.userGroups().find(g => g.id === this.groupId()) ?? null
  );

  public groupTrips = computed(() =>
    this.tripService.trips().filter(t => t.groupId === this.groupId())
  );

  public codeVisible = signal(false);
  public deleteConfirmVisible = signal(false);

  public isCreator = computed(() =>
    !!this.group() && this.group()!.creatorId === this.authService.currentUser()?.id
  );

  deleteGroup(): void {
    const g = this.group();
    if (!g) return;
    this.groupService.deleteGroup(g.id);
    this.deleteConfirmVisible.set(false);
    this.toastService.success(`Gruppo "${g.name}" eliminato.`);
    this.router.navigate(['/groups']);
  }

  copyCode(): void {
    const code = this.group()?.inviteCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    this.toastService.success(`Codice ${code} copiato negli appunti! 📋`);
  }

  shareGroup(): void {
    const g = this.group();
    if (!g) return;
    const text = `Unisciti al gruppo "${g.name}" su WanderBite! Codice: ${g.inviteCode}`;
    if (navigator.share) {
      navigator.share({ title: g.name, text });
    } else {
      navigator.clipboard.writeText(text);
      this.toastService.success('Link di condivisione copiato!');
    }
  }

  goBack(): void {
    this.router.navigate(['/groups']);
  }
}

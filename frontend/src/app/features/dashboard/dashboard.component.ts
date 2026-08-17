import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TripService } from '../../core/services/trip.service';
import { GroupService } from '../../core/services/group.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  public authService = inject(AuthService);
  public groupService = inject(GroupService);
  public tripService = inject(TripService);

  public groupName = computed(() => this.groupService.activeGroup()?.name || 'WanderBite');
  public membersCount = computed(() => this.groupService.activeGroup()?.members?.length || 0);
}

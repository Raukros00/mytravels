import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TripService } from '../../core/services/trip.service';
import { GroupService } from '../../core/services/group.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent {
  authService = inject(AuthService);
  tripService = inject(TripService);
  groupService = inject(GroupService);
}

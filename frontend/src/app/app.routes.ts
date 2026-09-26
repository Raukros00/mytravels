import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'trips'
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'groups',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/groups/group-list/group-list.component').then(m => m.GroupListComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/groups/group-detail/group-detail.component').then(m => m.GroupDetailComponent)
      }
    ]
  },
  {
    path: 'trips',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/trips/trip-list/trip-list.component').then(m => m.TripListComponent)
      },
      {
        path: 'new',
        loadComponent: () => import('./features/trips/trip-create/trip-create.component').then(m => m.TripCreateComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/trips/trip-detail/trip-detail.component').then(m => m.TripDetailComponent)
      }
    ]
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
  },
  {
    path: '**',
    redirectTo: 'trips'
  }
];

import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { authEntryGuard } from './core/guards/auth-entry.guard';
import { AuthService } from './core/services/auth.service';

/** Home: i viaggi per chi è loggato, Esplora (l'unica sezione pubblica) per i visitatori. */
const homeRedirect = () => (inject(AuthService).isAuthenticated() ? '/trips' : '/explore');

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: homeRedirect
  },
  // Accesso e registrazione sono una modale: queste rotte la aprono sopra Esplora.
  { path: 'login', canActivate: [authEntryGuard], data: { tab: 'login' }, children: [] },
  { path: 'register', canActivate: [authEntryGuard], data: { tab: 'register' }, children: [] },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    // Link invito a un gruppo: chi non è loggato accede dalla modale e poi torna qui.
    path: 'join/:code',
    canActivate: [authGuard],
    loadComponent: () => import('./features/groups/group-join/group-join.component').then(m => m.GroupJoinComponent)
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
        path: ':id/settings',
        loadComponent: () => import('./features/groups/group-settings/group-settings.component').then(m => m.GroupSettingsComponent)
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
        // Modalità "In viaggio": guida della giornata (#103).
        path: ':id/live',
        loadComponent: () => import('./features/trips/trip-live/trip-live.component').then(m => m.TripLiveComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/trips/trip-detail/trip-detail.component').then(m => m.TripDetailComponent)
      }
    ]
  },
  {
    path: 'explore',
    // Pubblica: visibile anche senza login.
    children: [
      {
        path: '',
        loadComponent: () => import('./features/explore/explore.component').then(m => m.ExploreComponent)
      },
      {
        path: ':id',
        loadComponent: () => import('./features/explore/explore-detail/explore-detail.component').then(m => m.ExploreDetailComponent)
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
    redirectTo: homeRedirect
  }
];

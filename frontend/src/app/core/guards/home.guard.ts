import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LiveTripService } from '../services/live-trip.service';

/**
 * Apertura dell'app (rotta ''): per i visitatori Esplora; per chi è loggato la guida della giornata se ha un
 * viaggio confermato in corso oggi (#104), altrimenti la lista dei viaggi. Solo qui: le altre navigazioni non
 * vengono mai dirottate sulla modalità "In viaggio".
 */
export const homeGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (!inject(AuthService).isAuthenticated()) return router.createUrlTree(['/explore']);
  return inject(LiveTripService).homeUrl('/trips').pipe(map(url => router.parseUrl(url)));
};

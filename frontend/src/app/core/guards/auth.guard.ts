import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthModalService } from '../services/auth-modal.service';

/**
 * Pagine riservate agli utenti loggati. Per un visitatore apre la modale di accesso
 * sopra Esplora (l'unica sezione pubblica) e, dopo il login, porta alla pagina richiesta.
 */
export const authGuard: CanActivateFn = (route, state) => {
  if (inject(AuthService).isAuthenticated()) return true;
  inject(AuthModalService).open({ tab: 'login', returnUrl: state.url });
  return inject(Router).createUrlTree(['/explore']);
};

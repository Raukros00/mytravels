import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthModalService, AuthTab } from '../services/auth-modal.service';

/**
 * /login e /register non sono più pagine: aprono la modale (scheda da `data.tab`) sopra Esplora.
 * Restano per i link esistenti; `?returnUrl=` viene rispettato dopo l'accesso.
 */
export const authEntryGuard: CanActivateFn = route => {
  const router = inject(Router);
  if (inject(AuthService).isAuthenticated()) return router.createUrlTree(['/trips']);
  const returnUrl = route.queryParamMap.get('returnUrl');
  inject(AuthModalService).open({
    tab: (route.data['tab'] as AuthTab) ?? 'login',
    // Solo percorsi interni: niente redirect verso altri siti.
    returnUrl: returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null
  });
  return router.createUrlTree(['/explore']);
};

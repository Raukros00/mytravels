import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { NetworkStatusService } from '../services/network-status.service';
import { isNetworkError } from '../utils/offline-queue.utils';

/** Solo le chiamate al nostro backend dicono se il server è raggiungibile (non i file di traduzione o altri siti). */
const API = /^(\/api\/|\/auth\/)/;

/**
 * Aggiorna lo stato della connessione (#109) in base all'esito delle richieste al backend:
 * risposta ricevuta → raggiungibile; status 0 / 504 → non raggiungibile (rete assente o service worker offline).
 */
export const networkStatusInterceptor: HttpInterceptorFn = (req, next) => {
  if (!API.test(req.url)) return next(req);
  const status = inject(NetworkStatusService);
  return next(req).pipe(
    tap({
      next: event => {
        if (event instanceof HttpResponse) status.markReachable();
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && isNetworkError(err.status)) status.markUnreachable();
        else status.markReachable();
      }
    })
  );
};

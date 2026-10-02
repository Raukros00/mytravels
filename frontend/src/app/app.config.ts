import { ApplicationConfig, provideZoneChangeDetection, isDevMode, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { I18nService } from './core/services/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTranslateService({
      lang: 'it',
      loader: {
        provide: TranslateLoader,
        useFactory: () => {
          const http = inject(HttpClient);
          return {
            getTranslation: (lang: string) => http.get(`/i18n/${lang}.json`)
          };
        }
      }
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: (i18n: I18nService) => () => i18n.init(),
      deps: [I18nService],
      multi: true
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};

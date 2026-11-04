import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Needed by the `date` pipe with the 'it' locale (e.g. "Membro dal" in the profile):
// without it the pipe throws NG0701 and the rest of the template is not rendered.
registerLocaleData(localeIt);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

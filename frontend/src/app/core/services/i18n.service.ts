import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

const LANG_KEY = 'wb_lang';
export type AppLang = 'it' | 'en';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private translate = inject(TranslateService);

  public currentLang = signal<AppLang>(this.resolveInitialLang());

  init(): Promise<void> {
    return firstValueFrom(this.translate.use(this.currentLang())).then(() => void 0);
  }

  switchLang(lang: AppLang): void {
    this.translate.use(lang);
    this.currentLang.set(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  toggle(): void {
    this.switchLang(this.currentLang() === 'it' ? 'en' : 'it');
  }

  private resolveInitialLang(): AppLang {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'it' || stored === 'en') return stored;
    return navigator.language.startsWith('en') ? 'en' : 'it';
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../../core/services/i18n.service';
import { ClockService } from '../../../core/services/clock.service';
import { todayIso } from '../../../core/utils/date.utils';
import { BadgeTrip, CountryBadge, countryBadges, countryName, flagEmoji } from '../../../core/utils/country-badges.utils';

interface BadgeView extends CountryBadge {
  flag: string;
  name: string;
  /** Formato della data "in arrivo": solo il mese nell'anno corrente, mese e anno altrimenti. */
  nextFormat: string;
}

/** Sezione "Le mie nazioni" del Profilo (#123): un badge per nazione, visitata o in arrivo. */
@Component({
  selector: 'app-profile-countries',
  imports: [DatePipe, RouterLink, TranslatePipe],
  templateUrl: './profile-countries.component.html',
  styleUrl: './profile-countries.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileCountriesComponent {
  private readonly i18n = inject(I18nService);
  private readonly clock = inject(ClockService);

  /** Viaggi di tutti i gruppi dell'utente (le proposte vengono ignorate). */
  readonly trips = input<BadgeTrip[]>([]);

  protected readonly lang = this.i18n.currentLang;
  /** Nazione di cui è aperto l'elenco dei viaggi. */
  protected readonly selected = signal<string | null>(null);

  protected readonly badges = computed<BadgeView[]>(() => {
    const lang = this.lang();
    const now = this.clock.now();
    const year = String(now.getFullYear());
    return countryBadges(this.trips(), now).map(b => ({
      ...b,
      flag: flagEmoji(b.code),
      name: countryName(b.code, lang),
      nextFormat: b.nextStart?.startsWith(year) ? 'MMMM' : 'MMMM y'
    }));
  });
  protected readonly selectedBadge = computed(() => this.badges().find(b => b.code === this.selected()) ?? null);

  protected toggle(code: string): void {
    this.selected.set(this.selected() === code ? null : code);
  }

  protected isPast(trip: BadgeTrip): boolean {
    return trip.endDate < todayIso(this.clock.now());
  }
}

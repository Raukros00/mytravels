import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../../core/services/i18n.service';
import { formatDistance } from '../../../core/utils/geo.utils';
import { RankedPlace, Suggestion, SuggestionAction, SuggestionsResult } from '../../../core/utils/live-suggestions.utils';

export interface SuggestionActionEvent {
  suggestion: Suggestion;
  action: SuggestionAction;
}

export interface SuggestionPickEvent {
  suggestion: Suggestion;
  place: RankedPlace;
}

/** Icone delle azioni (Material Symbols). */
const ACTION_ICONS: Record<SuggestionAction, string> = {
  directions: 'directions',
  go: 'directions_walk',
  done: 'check_circle',
  skip: 'redo',
  move: 'event_repeat',
  choose: 'restaurant_menu',
  list: 'list',
  booked: 'check',
  ignore: 'close',
  link: 'open_in_new'
};

const KIND_ICONS: Record<string, string> = {
  'start': 'flag',
  'meal-planned': 'restaurant',
  'meal-none': 'restaurant',
  'booking': 'event_available',
  'tickets': 'confirmation_number',
  'closing-soon': 'schedule',
  'closed-hours': 'schedule',
  'closed-today': 'block',
  'late': 'running_with_errors',
  'day-end': 'hotel'
};

/**
 * Suggerimenti della guida (#105): il principale in evidenza e i secondari sotto, con le loro azioni.
 * Le azioni le esegue la guida (`act`, `pick`); i link (indicazioni, biglietti) arrivano da `urlFor`.
 */
@Component({
  selector: 'app-live-suggestions',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-suggestions.component.html',
  styleUrl: './live-suggestions.component.css'
})
export class LiveSuggestionsComponent {
  private readonly i18n = inject(I18nService);

  readonly result = input.required<SuggestionsResult>();
  /** Link di un'azione (indicazioni, "Andiamo", biglietti); `null` = è un pulsante. */
  readonly urlFor = input.required<(s: Suggestion, action: SuggestionAction) => string | null>();
  /** Link delle indicazioni per un locale proposto. */
  readonly placeUrl = input.required<(place: RankedPlace) => string>();

  readonly act = output<SuggestionActionEvent>();
  readonly pick = output<SuggestionPickEvent>();

  protected readonly actionIcons = ACTION_ICONS;
  protected readonly kindIcons = KIND_ICONS;

  /** Suggerimento di cui è aperta la lista dei locali. */
  protected readonly openList = signal<string | null>(null);

  protected readonly all = computed(() => {
    const r = this.result();
    return r.primary ? [r.primary, ...r.secondary] : [];
  });

  /** Parametri del testo, con le parole tradotte (pasto, giorno) e il prezzo nella lingua corrente. */
  protected params(s: Suggestion, meal: string, weekday: string): Record<string, string | number> {
    const p: Record<string, string | number> = { ...s.params };
    if (s.params['meal'] !== undefined) p['meal'] = meal;
    if (s.params['weekday'] !== undefined) p['weekday'] = weekday;
    if (typeof s.params['price'] === 'number') p['price'] = this.formatPrice(s.params['price'], String(s.params['currency'] ?? 'EUR'));
    return p;
  }

  protected distance(place: RankedPlace): string {
    return place.distance === null ? '' : formatDistance(place.distance, this.i18n.currentLang());
  }

  protected onAction(s: Suggestion, action: SuggestionAction): void {
    if (action === 'choose' || action === 'list') {
      this.openList.update(id => (id === s.id ? null : s.id));
      return;
    }
    this.act.emit({ suggestion: s, action });
  }

  protected onPick(s: Suggestion, place: RankedPlace): void {
    this.openList.set(null);
    this.pick.emit({ suggestion: s, place });
  }

  private formatPrice(value: number, currency: string): string {
    const locale = this.i18n.currentLang() === 'en' ? 'en-US' : 'it-IT';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency', currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2
      }).format(value);
    } catch {
      return `${value} ${currency}`;
    }
  }
}

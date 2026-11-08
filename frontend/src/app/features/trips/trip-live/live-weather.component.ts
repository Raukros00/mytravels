import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { TripWeatherService } from '../../../core/services/trip-weather.service';
import { TimelineItem } from '../trip-detail/trip-detail.utils';
import {
  hourAt,
  isOutdoorStop,
  rainAdvice,
  rainLabel,
  rainOutlook,
  weatherInfo
} from '../../../core/utils/weather.utils';

/** Il minimo di una tappa della guida che serve al meteo. */
export interface WeatherStop {
  item: TimelineItem;
  times: { start: string; end: string | null } | null;
  done: boolean;
  skipped: boolean;
}

/**
 * Meteo della giornata nella guida "In viaggio" (#111): riga con icona, temperatura e pioggia
 * ("☀️ 21° · pioggia dalle 16:00") e, se serve, il suggerimento di anticipare le tappe all'aperto.
 * Senza previsioni (servizio non disponibile, data lontana, nessuna coordinata) non mostra niente.
 * Dati Open-Meteo (CC BY 4.0) con attribuzione.
 */
@Component({
  selector: 'app-live-weather',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as w) {
      <div class="live-weather" data-cy="live-weather">
        <p class="live-weather-line" [attr.aria-label]="w.aria">
          <span class="live-weather-icon" aria-hidden="true">{{ w.icon }}</span>
          <strong class="live-weather-temp">{{ w.temp }}</strong>
          <span class="live-weather-rain" [class.live-weather-rain--wet]="w.wet">· {{ w.rain }}</span>
          <span class="live-weather-range">{{ w.range }}</span>
        </p>
        @if (advice(); as a) {
          <p class="live-weather-advice" data-cy="live-rain-advice" role="note">
            <span class="material-symbols-outlined" aria-hidden="true">umbrella</span>
            <span>{{ a.text }}</span>
          </p>
        }
        <a class="live-weather-credit" href="https://open-meteo.com/" target="_blank" rel="noopener">Meteo: Open-Meteo.com</a>
      </div>
    }
  `,
  styles: `
    .live-weather { display: flex; flex-direction: column; gap: 0.35rem; }
    .live-weather-line { margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.35rem; font-size: 1.05rem; color: var(--wb-text-secondary); }
    .live-weather-icon { font-size: 1.3rem; line-height: 1; }
    .live-weather-temp { color: var(--wb-text-primary); }
    .live-weather-rain--wet { color: var(--wb-accent-dark); font-weight: 600; }
    .live-weather-range { font-size: 0.85rem; color: var(--wb-text-tertiary); }
    .live-weather-advice { margin: 0; display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: var(--wb-radius-md, 12px);
      background: var(--wb-accent-surface); border: 1px solid var(--wb-accent-border); color: var(--wb-text-primary); font-size: 0.95rem; line-height: 1.35; }
    .live-weather-advice .material-symbols-outlined { color: var(--wb-accent-dark); font-size: 1.25rem; }
    .live-weather-credit { align-self: flex-start; font-size: 0.75rem; color: var(--wb-text-tertiary); }
  `
})
export class LiveWeatherComponent {
  private readonly weather = inject(TripWeatherService);

  readonly tripId = input.required<string>();
  /** Giorno del viaggio (`yyyy-MM-dd`). */
  readonly date = input.required<string>();
  /** Ora attuale in minuti dalla mezzanotte. */
  readonly nowMinutes = input.required<number>();
  readonly stops = input<readonly WeatherStop[]>([]);

  private readonly forecast = toSignal(
    toObservable(computed(() => `${this.tripId()}|${this.date()}`)).pipe(
      distinctUntilChanged(),
      switchMap(key => {
        const [id, date] = key.split('|');
        return id && date ? this.weather.forecast(id, date) : of(null);
      }),
      map(f => f ?? null)
    ),
    { initialValue: null }
  );

  private readonly outlook = computed(() => {
    const f = this.forecast();
    return f ? rainOutlook(f.hourly ?? [], this.nowMinutes()) : null;
  });

  protected readonly view = computed(() => {
    const f = this.forecast();
    const outlook = this.outlook();
    if (!f?.daily || !outlook) return null;
    const now = this.nowMinutes();
    const current = hourAt(f.hourly ?? [], now);
    const night = now < 6 * 60 || now >= 21 * 60;
    const info = weatherInfo(current?.weatherCode ?? f.daily.weatherCode, night);
    const temp = current?.temperature ?? f.daily.temperatureMax;
    const { temperatureMax: max, temperatureMin: min } = f.daily;
    const range = max != null && min != null ? `max ${Math.round(max)}° · min ${Math.round(min)}°` : '';
    const tempLabel = temp != null ? `${Math.round(temp)}°` : '';
    const rain = rainLabel(outlook);
    return {
      icon: info.icon,
      temp: tempLabel,
      rain,
      wet: outlook.kind !== 'none',
      range,
      aria: `${info.label}, ${tempLabel}, ${rain}${range ? ', ' + range : ''}`
    };
  });

  protected readonly advice = computed(() => {
    const outlook = this.outlook();
    if (!outlook) return null;
    const stops = this.stops().map(s => ({
      name: s.item.name,
      outdoor: isOutdoorStop(s.item.type, (s.item.raw as { category?: string }).category),
      times: s.times,
      done: s.done,
      skipped: s.skipped
    }));
    return rainAdvice(stops, outlook, this.nowMinutes());
  });
}

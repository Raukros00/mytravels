import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TripService } from '../../../core/services/trip.service';
import { ClockService } from '../../../core/services/clock.service';
import { LiveTripService } from '../../../core/services/live-trip.service';
import { MapsPreferenceService } from '../../../core/services/maps-preference.service';
import { I18nService } from '../../../core/services/i18n.service';
import { TripActivity, TripPlaceToEat } from '../../../core/models/trip.model';
import { todayIso } from '../../../core/utils/date.utils';
import { TimeRange, effectiveTimes } from '../../../core/utils/day-schedule.utils';
import {
  LiveStopInput,
  LiveStopStatus,
  computeLiveDay,
  minutesOfDay,
  tripDayDate,
  tripDayInfo
} from '../../../core/utils/live-day.utils';
import {
  RankedPlace,
  SuggestPlace,
  SuggestStop,
  Suggestion,
  SuggestionAction,
  SuggestionsResult,
  computeSuggestions
} from '../../../core/utils/live-suggestions.utils';
import { MAPS_APP_LABELS, MapPlace, MapsApp, formatWalkEstimate, isRoutable, walkEstimate } from '../../../core/utils/directions.utils';
import { TimelineItem, buildDayTimeline, mealOf } from '../trip-detail/trip-detail.utils';
import { TripMovePanelComponent } from '../trip-move/trip-move-panel.component';
import { MoveUndoBarComponent } from '../trip-move/move-undo-bar.component';
import { StopRef, recoverStops } from '../trip-move/stop-move.service';
import { LiveWeatherComponent } from './live-weather.component';
import { OfflineBannerComponent } from '../../../shared/components/offline-banner/offline-banner.component';
import { LiveSuggestionsComponent, SuggestionActionEvent, SuggestionPickEvent } from './live-suggestions.component';

const DISMISSED_KEY = 'wb_live_dismissed';

/** Come arrivare a una tappa (#106): da dove si parte e la stima a piedi dalla partenza. */
interface StopLeg {
  origin: MapPlace | null;
  /** La partenza è l'alloggio (prima tappa della giornata). */
  fromHome: boolean;
  /** "1,2 km · ~15 min a piedi", solo se partenza e tappa hanno coordinate. */
  walk: string | null;
}

/** Una tappa della giornata nella guida: la voce dell'itinerario più orari e stato. */
interface LiveStop extends LiveStopInput {
  item: TimelineItem;
}

const STATUS_LABELS: Record<LiveStopStatus, string> = {
  done: 'Fatta',
  skipped: 'Saltata',
  current: 'In corso',
  next: 'Prossima',
  todo: 'Da fare',
  missed: 'Non segnata'
};

/**
 * Modalità "In viaggio" (#103): guida della giornata da usare in giro col telefono.
 * Adesso (tappa in corso o prossima, con Fatto / Salta / Indicazioni), Dopo (le 1–2 successive) e la
 * Giornata con lo stato di ogni tappa. La logica è in core/utils/live-day.utils.ts (funzioni pure).
 * #112: "Sposta" sulle tappe, lista "Da recuperare" dei giorni passati e ripasso di fine giornata.
 * #105: suggerimenti contestuali (core/utils/live-suggestions.utils.ts) con le loro azioni.
 * #106: indicazioni con i mezzi pubblici nell'app di mappe del dispositivo e stima a piedi tra le tappe.
 * #111: meteo della giornata nell'intestazione (LiveWeatherComponent).
 * #109: uso offline (dati salvati, banner e modifiche in coda: OfflineBannerComponent, OfflineQueueService).
 */
@Component({
  selector: 'app-trip-live',
  standalone: true,
  imports: [RouterLink, TranslatePipe, TripMovePanelComponent, MoveUndoBarComponent, LiveSuggestionsComponent, LiveWeatherComponent,
    OfflineBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
  templateUrl: './trip-live.component.html',
  styleUrl: './trip-live.component.css'
})
export class TripLiveComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly tripService = inject(TripService);
  protected readonly clock = inject(ClockService);
  private readonly liveTrips = inject(LiveTripService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  protected readonly maps = inject(MapsPreferenceService);
  protected readonly mapsLabels = MAPS_APP_LABELS;

  protected readonly statusLabels = STATUS_LABELS;

  private readonly tripId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') }
  );

  protected readonly trip = computed(() => {
    const id = this.tripId();
    return id ? this.tripService.getTripById(id) : undefined;
  });

  /**
   * Sempre la copia del server all'apertura: tappe segnate dagli altri membri comprese.
   * #109: precaricata anche per l'uso offline (viaggio e membri restano salvati sul dispositivo).
   */
  private readonly loadTrip = effect(() => {
    const id = this.tripId();
    if (id) this.tripService.prefetchForOffline(id);
  });

  protected readonly today = computed(() => todayIso(this.clock.now()));

  /** Più viaggi in corso oggi: selettore in alto (#104). */
  protected readonly ongoingTrips = computed(() => {
    const list = this.liveTrips.ongoingTrips();
    return list.length > 1 ? [...list].sort((a, b) => a.title.localeCompare(b.title, 'it')) : [];
  });

  /** Viaggio aperto durante il viaggio: all'apertura dell'app si riparte da qui (#104). */
  private readonly rememberTrip = effect(() => {
    const t = this.trip();
    if (t && this.dayInfo()?.state === 'during') this.liveTrips.markUsed(t.id);
  });

  protected readonly dayInfo = computed(() => {
    const t = this.trip();
    return t ? tripDayInfo(t.startDate, t.endDate, this.today()) : null;
  });

  /** Tappe del giorno di oggi in sequenza, con orari effettivi e stato. */
  protected readonly stops = computed<LiveStop[]>(() => {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || info?.state !== 'during') return [];
    return buildDayTimeline(t.activities ?? [], t.placesToEat ?? [], info.dayNumber).map(item => toLiveStop(item));
  });

  protected readonly nowMinutes = computed(() => minutesOfDay(this.clock.now()));

  protected readonly live = computed(() => computeLiveDay(this.stops(), this.nowMinutes()));

  private readonly dismissedKey = computed(() => {
    const id = this.tripId();
    return id ? `${DISMISSED_KEY}:${id}:${this.today()}` : null;
  });

  /** Suggerimenti chiusi ("Ignora", "Sì") per questo viaggio e oggi, ricordati sul dispositivo (#105). */
  private readonly dismissed = linkedSignal<ReadonlySet<string>>(() => {
    const key = this.dismissedKey();
    return new Set(key ? readList(key) : []);
  });

  /** Suggerimento principale e secondari (#105). */
  protected readonly suggestions = computed<SuggestionsResult>(() => {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || info?.state !== 'during') return { primary: null, secondary: [] };
    const now = this.clock.now();
    const places: SuggestPlace[] = (t.placesToEat ?? [])
      .filter(p => !p.isVisited && (p.assignedDay == null || (p.assignedDay === info.dayNumber && !p.isSkipped)))
      .map(p => ({
        id: p.id, name: p.name, address: p.address || null, meal: mealOf(p), coordinates: p.coordinates ?? null,
        today: p.assignedDay === info.dayNumber
      }));
    return computeSuggestions({
      nowMinutes: minutesOfDay(now),
      weekday: now.getDay(),
      stops: this.stops().map(toSuggestStop),
      places,
      accommodation: t.accommodation?.name ? { name: t.accommodation.name, coordinates: t.accommodation.coordinates ?? null } : null,
      dismissed: this.dismissed()
    });
  });

  /** Link delle azioni dei suggerimenti: indicazioni, "Andiamo", biglietti / prenotazione. */
  protected readonly suggestionUrl = (s: Suggestion, action: SuggestionAction): string | null => {
    if (action === 'link') return s.url ?? null;
    if (action !== 'directions' && action !== 'go') return null;
    const stop = s.stopId ? this.findStop(s.stopId) : null;
    if (stop) return this.stopDirections(stop);
    return this.homeDirections();
  };

  /** Indicazioni per un locale proposto per il pasto: si parte dalla tappa in corso o dalla precedente. */
  protected readonly placeUrl = (place: RankedPlace): string => this.maps.url(place, this.hereOrigin());

  /**
   * Per ogni tappa (#106): partenza = tappa precedente non saltata, per la prima l'alloggio; stima a piedi se
   * entrambe hanno coordinate.
   */
  protected readonly legs = computed(() => {
    const lang = this.i18n.currentLang();
    const home = this.homePlace();
    const result = new Map<string, StopLeg>();
    let previous: MapPlace | null = null;
    for (const stop of this.stops()) {
      const here = placeOf(stop);
      const origin = previous ?? home;
      const estimate = walkEstimate(origin, here);
      result.set(stop.id, { origin, fromHome: !previous && !!home, walk: estimate ? formatWalkEstimate(estimate, lang) : null });
      if (!stop.skipped && isRoutable(here)) previous = here;
    }
    return result;
  });

  /** Tappa di cui è aperto il pannello "Sposta" (#112). */
  protected readonly moving = signal<StopRef | null>(null);

  /** Da recuperare (#112): saltate o non fatte nei giorni passati (quelle di oggi sono nella Giornata). */
  protected readonly toRecover = computed(() => {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || info?.state !== 'during') return [];
    return recoverStops(t, info.dayNumber).filter(s => s.assignedDay !== info.dayNumber);
  });

  /** Ripasso di fine giornata (#112): tappe di oggi rimaste da fare o saltate. */
  protected readonly leftToday = computed(() =>
    this.live().phase === 'finished' ? this.stops().filter(s => !s.done) : []
  );

  protected readonly leftTodayNames = computed(() => this.leftToday().map(s => s.item.name).join(', '));

  protected readonly dayTitle = computed(() => {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || !info) return '';
    return `Giorno ${info.dayNumber} di ${info.totalDays} · ${t.destination}`;
  });

  protected readonly todayLabel = computed(() => longDate(this.today()));

  protected readonly clockLabel = computed(() => {
    const now = this.clock.now();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  /** Le prime tappe di domani, per la fine della giornata. */
  protected readonly tomorrowStops = computed(() => {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || !info || info.state !== 'during' || info.isLastDay) return [];
    return buildDayTimeline(t.activities ?? [], t.placesToEat ?? [], info.dayNumber + 1).slice(0, 3);
  });

  /** Giornata vuota: idee non ancora assegnate a un giorno (backlog). */
  protected readonly backlog = computed(() => {
    const t = this.trip();
    if (!t) return [];
    const activities = (t.activities ?? []).filter(a => a.assignedDay == null)
      .map(a => ({ type: 'activity' as const, id: a.id, name: a.name, address: a.address }));
    const places = (t.placesToEat ?? []).filter(p => p.assignedDay == null)
      .map(p => ({ type: 'food' as const, id: p.id, name: p.name, address: p.address }));
    return [...activities, ...places].slice(0, 4);
  });

  protected readonly tomorrowLabel = computed(() => {
    const t = this.trip();
    const info = this.dayInfo();
    return t && info ? longDate(tripDayDate(t.startDate, info.dayNumber + 1)) : '';
  });

  protected focusTiming(): string {
    const live = this.live();
    const stop = live.focus;
    if (!stop) return '';
    if (live.focusKind === 'current') return stop.times ? 'Adesso' : 'Adesso · senza orario';
    if (live.phase === 'before') return `La giornata inizia alle ${stop.times!.start}`;
    return `Prossima tappa · ${formatWait(live.minutesToFocus ?? 0)}`;
  }

  protected statusOf(stop: LiveStop): LiveStopStatus {
    return this.live().statuses.get(stop.id) ?? 'todo';
  }

  /** Indicazioni con i mezzi pubblici verso la tappa, dalla tappa precedente (o dall'alloggio) se non si sa dove si è. */
  protected stopDirections(stop: LiveStop): string {
    return this.maps.url(placeOf(stop), this.legs().get(stop.id)?.origin ?? null);
  }

  /** Indicazioni per tornare all'alloggio: dall'ultima tappa con un luogo, se non si sa dove si è. */
  protected homeDirections(): string | null {
    const home = this.homePlace();
    return home ? this.maps.url(home, this.lastPlace()) : null;
  }

  protected leg(stop: LiveStop): StopLeg | null {
    return this.legs().get(stop.id) ?? null;
  }

  protected chooseMapsApp(app: MapsApp): void {
    this.maps.setApp(app);
  }

  private homePlace(): MapPlace | null {
    const home = this.trip()?.accommodation;
    return home?.name || home?.address ? { name: home.name, address: home.address, coordinates: home.coordinates ?? null } : null;
  }

  /** Dove si è adesso secondo il programma: la tappa in corso, altrimenti la precedente, altrimenti l'alloggio. */
  private hereOrigin(): MapPlace | null {
    const live = this.live();
    if (live.focus && live.focusKind === 'current' && isRoutable(placeOf(live.focus))) return placeOf(live.focus);
    if (live.focus) return this.legs().get(live.focus.id)?.origin ?? null;
    return this.lastPlace();
  }

  /** L'ultima tappa della giornata (non saltata) con un luogo, altrimenti `null`. */
  private lastPlace(): MapPlace | null {
    const stops = this.stops().filter(s => !s.skipped).map(placeOf).filter(isRoutable);
    return stops[stops.length - 1] ?? null;
  }

  protected markDone(stop: LiveStop): void {
    this.save(stop, true, false, `"${stop.item.name}" fatto ✓`);
  }

  protected skip(stop: LiveStop): void {
    this.save(stop, false, true, `"${stop.item.name}" saltato.`);
  }

  protected openMove(ref: StopRef): void {
    this.moving.set({ type: ref.type, id: ref.id });
  }

  /** Torna "da fare" (annulla Fatto o Salta). */
  protected restore(stop: LiveStop): void {
    this.save(stop, false, false, `"${stop.item.name}" di nuovo da fare.`);
  }

  /** Giornata vuota: aggiunge un'idea del backlog a oggi (in fondo, in base all'orario). */
  protected addToToday(entry: { type: 'activity' | 'food'; id: string }): void {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || !info) return;
    const changes = { assignedDay: info.dayNumber, dayOrder: null };
    if (entry.type === 'activity') this.tripService.updateActivity(t.id, entry.id, changes, 'Aggiunta alla giornata di oggi.');
    else this.tripService.updatePlaceToEat(t.id, entry.id, changes, 'Aggiunto alla giornata di oggi.');
  }

  /** Azioni dei suggerimenti (#105): Salta e Sposta usano il flusso della #112. */
  protected onSuggestionAction({ suggestion, action }: SuggestionActionEvent): void {
    const stop = suggestion.stopId ? this.findStop(suggestion.stopId) : null;
    switch (action) {
      case 'done':
        if (stop) this.markDone(stop);
        break;
      case 'skip':
        if (stop) this.skip(stop);
        break;
      case 'move':
        if (stop) this.openMove(stop.item);
        break;
      case 'booked':
      case 'ignore':
        this.dismiss(suggestion.id);
        break;
    }
  }

  /**
   * Scelta di un locale per il pasto: va nella giornata di oggi per quel pasto. Al posto di quello in programma
   * ("Scegli un altro") prende i suoi orari, e quello in programma viene saltato (finisce in "Da recuperare").
   */
  protected onSuggestionPick({ suggestion, place }: SuggestionPickEvent): void {
    const t = this.trip();
    const info = this.dayInfo();
    if (!t || !info) return;
    const meal = String(suggestion.params['meal'] ?? '');
    const mealWord = this.translate.instant(`live.suggest.meals.${meal}`);
    const planned = suggestion.kind === 'meal-planned' && suggestion.stopId ? this.findStop(suggestion.stopId) : null;
    const changes: Partial<TripPlaceToEat> = {
      assignedDay: info.dayNumber,
      assignedMeal: (meal || null) as TripPlaceToEat['assignedMeal'],
      dayOrder: null,
      isSkipped: false
    };
    if (planned) {
      const raw = planned.item.raw as TripPlaceToEat;
      Object.assign(changes, { startTime: raw.startTime ?? null, endTime: raw.endTime ?? null, timeSlot: raw.timeSlot ?? '' });
      this.tripService.updatePlaceToEat(t.id, place.id, changes,
        this.translate.instant('live.suggest.picked_instead', { name: place.name, old: planned.item.name }));
      this.save(planned, false, true, `"${planned.item.name}" saltato.`);
    } else {
      this.tripService.updatePlaceToEat(t.id, place.id, changes, this.translate.instant('live.suggest.picked', { name: place.name, meal: mealWord }));
    }
  }

  private dismiss(id: string): void {
    const next = new Set(this.dismissed());
    next.add(id);
    this.dismissed.set(next);
    const key = this.dismissedKey();
    if (key) writeList(key, [...next]);
  }

  private findStop(id: string): LiveStop | null {
    return this.stops().find(s => s.id === id) ?? null;
  }

  /** Tornando sull'app: ora aggiornata e tappe segnate nel frattempo dagli altri membri. */
  protected onVisibilityChange(): void {
    if (document.visibilityState !== 'visible') return;
    this.clock.tick();
    const id = this.tripId();
    if (id) this.tripService.ensureTripLoaded(id);
    this.liveTrips.refresh().subscribe();
  }

  /** Fatto / saltato con l'endpoint della singola tappa: gli altri membri lo vedono al prossimo caricamento. */
  private save(stop: LiveStop, done: boolean, skipped: boolean, message: string): void {
    const t = this.trip();
    if (!t) return;
    if (stop.item.type === 'activity') {
      this.tripService.updateActivity(t.id, stop.item.id, { isCompleted: done, isSkipped: skipped }, message);
    } else {
      this.tripService.updatePlaceToEat(t.id, stop.item.id, { isVisited: done, isSkipped: skipped }, message);
    }
  }

}

function toLiveStop(item: TimelineItem): LiveStop {
  const raw = item.raw;
  const times: TimeRange | null = effectiveTimes({
    ...raw,
    assignedMeal: item.type === 'food' ? mealOf(raw as TripPlaceToEat) : null
  });
  return {
    id: `${item.type}:${item.id}`,
    item,
    times: times ? { start: times.start, end: times.end } : null,
    done: !!item.isCompleted,
    skipped: !!item.isSkipped
  };
}

/** Il luogo di una tappa per le indicazioni: coordinate, nome e indirizzo. */
function placeOf(stop: LiveStop): MapPlace {
  return { name: stop.item.name, address: stop.item.address ?? null, coordinates: stop.item.raw.coordinates ?? null };
}

/** I dati di una tappa che servono ai suggerimenti (#105). */
function toSuggestStop(stop: LiveStop): SuggestStop {
  const raw = stop.item.raw;
  const isActivity = stop.item.type === 'activity';
  const activity = isActivity ? (raw as TripActivity) : null;
  return {
    id: stop.id,
    times: stop.times,
    done: stop.done,
    skipped: stop.skipped,
    type: stop.item.type,
    name: stop.item.name,
    meal: isActivity ? null : mealOf(raw as TripPlaceToEat),
    openingHours: raw.openingHours ?? null,
    closingDays: raw.closingDays ?? null,
    bookingRequired: !!raw.bookingRequired,
    ticketsRequired: !!activity?.ticketsRequired,
    ticketPrice: activity?.ticketPrice ?? null,
    currency: activity?.currency ?? null,
    bookingUrl: activity?.bookingUrl ?? null,
    coordinates: raw.coordinates ?? null
  };
}

/** Liste salvate sul dispositivo (localStorage può mancare o essere bloccato: in quel caso non si ricorda nulla). */
function readList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value.filter(v => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-50)));
  } catch {
    // Spazio pieno o storage bloccato: il suggerimento resta chiuso solo finché la pagina è aperta.
  }
}

/** "venerdì 3 luglio" da una data `yyyy-MM-dd`. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** "tra 45 min", "tra 1 h 30 min". */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `tra ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `tra ${h} h ${m} min` : `tra ${h} h`;
}

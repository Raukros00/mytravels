import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { TripService } from '../../../core/services/trip.service';
import { ClockService } from '../../../core/services/clock.service';
import { LiveTripService } from '../../../core/services/live-trip.service';
import { TripPlaceToEat } from '../../../core/models/trip.model';
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
import { TimelineItem, buildDayTimeline, getNavigationUrl, mealOf } from '../trip-detail/trip-detail.utils';
import { TripMovePanelComponent } from '../trip-move/trip-move-panel.component';
import { MoveUndoBarComponent } from '../trip-move/move-undo-bar.component';
import { StopRef, recoverStops } from '../trip-move/stop-move.service';
import { LiveWeatherComponent } from './live-weather.component';

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
 * #111: meteo della giornata nell'intestazione (LiveWeatherComponent).
 */
@Component({
  selector: 'app-trip-live',
  standalone: true,
  imports: [RouterLink, TripMovePanelComponent, MoveUndoBarComponent, LiveWeatherComponent],
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

  protected readonly statusLabels = STATUS_LABELS;

  private readonly tripId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') }
  );

  protected readonly trip = computed(() => {
    const id = this.tripId();
    return id ? this.tripService.getTripById(id) : undefined;
  });

  /** Sempre la copia del server all'apertura: tappe segnate dagli altri membri comprese. */
  private readonly loadTrip = effect(() => {
    const id = this.tripId();
    if (id) this.tripService.ensureTripLoaded(id);
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

  protected directionsUrl(name: string, address?: string): string {
    return getNavigationUrl(name, address);
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

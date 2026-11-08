import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ClockService } from '../../../core/services/clock.service';
import { Trip, TripActivity, TripPlaceToEat } from '../../../core/models/trip.model';
import { todayIso } from '../../../core/utils/date.utils';
import { TimeRange, effectiveTimes, formatTimeRange, validateTimeRange } from '../../../core/utils/day-schedule.utils';
import { minutesOfDay, tripDayDate, tripDayInfo } from '../../../core/utils/live-day.utils';
import { CandidateDay, DAY_END, DAY_START, DayOption, buildDayOptions, parseClosingDays } from '../../../core/utils/reschedule.utils';
import { buildDayTimeline, mealOf } from '../trip-detail/trip-detail.utils';
import { StopMoveService, StopRef } from './stop-move.service';

const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const DAY_MINUTES = (Number(DAY_END.slice(0, 2)) - Number(DAY_START.slice(0, 2))) * 60;

/**
 * Pannello "Sposta" (#112): i giorni rimanenti con carico, fasce libere, avvisi (chiuso, orari di apertura,
 * biglietti/prenotazione) e il giorno consigliato; scelto il giorno, la tappa va nella prima fascia libera
 * compatibile (orari modificabili). Si può anche rimettere la tappa tra le idee non assegnate.
 * Durante il viaggio i giorni rimanenti partono da oggi; prima della partenza ci sono tutti.
 */
@Component({
  selector: 'app-trip-move-panel',
  standalone: true,
  imports: [ModalComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-move-panel.component.html',
  styleUrl: './trip-move-panel.component.css'
})
export class TripMovePanelComponent {
  private readonly clock = inject(ClockService);
  private readonly mover = inject(StopMoveService);

  readonly trip = input.required<Trip>();
  /** Tappa da spostare; `null` = pannello chiuso. */
  readonly stop = input<StopRef | null>(null);
  readonly closed = output<void>();

  protected readonly selectedDay = signal<number | null>(null);
  protected readonly startTime = signal('');
  protected readonly endTime = signal('');

  protected readonly item = computed<TripActivity | TripPlaceToEat | null>(() => {
    const ref = this.stop();
    const t = this.trip();
    if (!ref) return null;
    const list: (TripActivity | TripPlaceToEat)[] = ref.type === 'activity' ? t.activities ?? [] : t.placesToEat ?? [];
    return list.find(i => i.id === ref.id) ?? null;
  });

  private readonly itemTimes = computed<TimeRange | null>(() => {
    const item = this.item();
    if (!item) return null;
    const meal = this.stop()?.type === 'food' ? mealOf(item as TripPlaceToEat) : null;
    const times = effectiveTimes({ ...item, assignedMeal: meal });
    return times ? { start: times.start, end: times.end } : null;
  });

  /** Giorni in cui si può spostare: da oggi (durante il viaggio) o tutti (prima), tranne quello attuale. */
  protected readonly options = computed<DayOption[]>(() => {
    const t = this.trip();
    const item = this.item();
    const ref = this.stop();
    if (!item || !ref) return [];
    const info = tripDayInfo(t.startDate, t.endDate, todayIso(this.clock.now()));
    if (info.state === 'after') return [];
    const first = info.state === 'during' ? info.dayNumber : 1;
    const days: CandidateDay[] = [];
    for (let day = first; day <= info.totalDays; day++) {
      if (day === item.assignedDay) continue;
      const stops = buildDayTimeline(t.activities ?? [], t.placesToEat ?? [], day)
        .filter(s => !s.isSkipped && !(s.type === ref.type && s.id === ref.id))
        .map(s => {
          const times = effectiveTimes({ ...s.raw, assignedMeal: s.type === 'food' ? mealOf(s.raw as TripPlaceToEat) : null });
          return times ? { start: times.start, end: times.end } : null;
        });
      const isToday = info.state === 'during' && day === info.dayNumber;
      days.push({ day, date: tripDayDate(t.startDate, day), stops, notBefore: isToday ? minutesOfDay(this.clock.now()) : 0 });
    }
    const hasBooking = ref.type === 'activity'
      ? !!((item as TripActivity).ticketsRequired || (item as TripActivity).bookingRequired)
      : !!(item as TripPlaceToEat).bookingRequired;
    return buildDayOptions(
      { times: this.itemTimes(), closingDays: item.closingDays, openingHours: item.openingHours, hasBooking },
      days
    );
  });

  protected readonly recommended = computed(() => this.options().find(o => o.recommended) ?? null);
  protected readonly selected = computed(() => this.options().find(o => o.day === this.selectedDay()) ?? null);
  protected readonly timeError = computed(() => validateTimeRange(this.startTime(), this.endTime()));

  /** All'apertura (cambia la tappa): preseleziona il giorno consigliato, senza cambiare poi la scelta dell'utente. */
  private readonly preselect = effect(() => {
    if (!this.stop()) return;
    untracked(() => this.choose(this.recommended()));
  });

  protected choose(option: DayOption | null): void {
    this.selectedDay.set(option?.day ?? null);
    this.startTime.set(option?.proposed?.start ?? '');
    this.endTime.set(option?.proposed?.end ?? '');
  }

  protected dayLabel(option: DayOption): string {
    const [y, m, d] = option.date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  protected loadPercent(option: DayOption): number {
    return Math.min(100, Math.round((option.load.busyMinutes / DAY_MINUTES) * 100));
  }

  protected loadLabel(option: DayOption): string {
    const { count, busyMinutes } = option.load;
    const stops = count === 0 ? 'Nessuna tappa' : `${count} ${count === 1 ? 'tappa' : 'tappe'}`;
    if (!busyMinutes) return stops;
    const h = Math.floor(busyMinutes / 60);
    const m = busyMinutes % 60;
    return `${stops} · ${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''} occupate`;
  }

  protected freeLabel(option: DayOption): string {
    if (!option.free.length) return 'Nessuna fascia libera';
    return 'Libero ' + option.free.map(f => (f.end === DAY_END ? `dalle ${f.start}` : formatTimeRange(f.start, f.end))).join(', ');
  }

  protected closedLabel(option: DayOption): string {
    const [y, m, d] = option.date.split('-').map(Number);
    return `Chiuso di ${WEEKDAYS[new Date(y, m - 1, d).getDay()]}`;
  }

  protected recommendationText(): string {
    const rec = this.recommended();
    const item = this.item();
    if (!rec || !item) return '';
    const parts = [rec.proposed ? `alle ${rec.proposed.start}` : '', rec.free.length ? this.freeLabel(rec).toLowerCase() : ''];
    if (item.openingHours) parts.push(`aperto ${item.openingHours}`);
    return `Consigliato: Giorno ${rec.day} (${parts.filter(Boolean).join(', ')})`;
  }

  protected hasClosingInfo(): boolean {
    return parseClosingDays(this.item()?.closingDays).size > 0;
  }

  protected confirm(): void {
    const ref = this.stop();
    const day = this.selectedDay();
    if (!ref || day === null || this.timeError()) return;
    const start = this.startTime() || null;
    const times = start ? { start, end: this.endTime() || null } : null;
    this.mover.move(this.trip().id, ref, day, times);
    this.closed.emit();
  }

  protected toBacklog(): void {
    const ref = this.stop();
    if (!ref) return;
    this.mover.move(this.trip().id, ref, null, null);
    this.closed.emit();
  }
}

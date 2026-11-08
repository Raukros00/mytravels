import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TimelineItem, formatDayDate, getNavigationUrl } from '../../trip-detail.utils';
import { moveStop } from '../../../../../core/utils/day-schedule.utils';
import { InteractiveMapComponent, MapStopPoint } from '../../../../../shared/components/map/interactive-map.component';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { PoiLocateComponent } from '../../../../../shared/components/poi-autocomplete/poi-locate.component';
import { GeoPoint } from '../../../../../core/models/trip.model';
import { Poi } from '../../../../../core/services/poi.service';

@Component({
  selector: 'app-trip-itinerary',
  standalone: true,
  imports: [InteractiveMapComponent, EmptyStateComponent, PoiLocateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-itinerary.component.html',
  styleUrl: './trip-itinerary.component.css'
})
export class TripItineraryComponent {
  readonly tripDays = input.required<number[]>();
  readonly selectedDay = input.required<number>();
  /** Tappe del giorno, già nella sequenza della giornata. */
  readonly timelineItems = input.required<TimelineItem[]>();
  readonly mapStops = input.required<MapStopPoint[]>();
  readonly mapCenter = input.required<[number, number]>();
  readonly dayFoodCount = input(0);
  readonly dayActivityCount = input(0);
  readonly startDate = input<string | undefined>();
  /** Destinazione del viaggio: "Trova sulla mappa" preferisce i luoghi vicini. */
  readonly near = input<GeoPoint | null>(null);

  readonly daySelected = output<number>();
  readonly addStep = output<void>();
  readonly unassignItem = output<TimelineItem>();
  readonly editTime = output<TimelineItem>();
  /** "Sposta" a un altro giorno (#112): pannello con i giorni e il giorno consigliato. */
  readonly moveItem = output<TimelineItem>();
  /** Nuova sequenza delle tappe del giorno (frecce o trascinamento). */
  readonly reorder = output<TimelineItem[]>();
  /** Posizione trovata e confermata per una tappa che non l'aveva. */
  readonly locate = output<{ item: TimelineItem; coordinates: GeoPoint }>();

  /** Trascinamento solo con il mouse: sui touch (dove il trascinamento HTML non funziona) ci sono le frecce. */
  protected readonly canDrag = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

  /** Tappa trascinata e posizione su cui si trova. */
  protected readonly dragIndex = signal<number | null>(null);
  protected readonly dropIndex = signal<number | null>(null);
  /** Annuncio per gli screen reader dopo uno spostamento. */
  protected readonly moveAnnouncement = signal('');

  protected dayDate(dayNum: number): string {
    return formatDayDate(this.startDate(), dayNum);
  }

  protected navUrl(name: string, address?: string): string {
    return getNavigationUrl(name, address);
  }

  /** Testo da cercare sulla mappa: l'indirizzo, o il nome se manca. */
  protected locateQuery(item: TimelineItem): string {
    return item.address?.trim() || item.name;
  }

  protected located(item: TimelineItem, poi: Poi): void {
    this.locate.emit({ item, coordinates: { lat: poi.lat, lng: poi.lng } });
  }

  protected move(index: number, delta: number): void {
    const items = this.timelineItems();
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    this.reorder.emit(moveStop(items, index, target));
    this.moveAnnouncement.set(`${items[index].name} spostata in posizione ${target + 1} di ${items.length}.`);
  }

  protected onDragStart(event: DragEvent, index: number): void {
    this.dragIndex.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', this.timelineItems()[index].id);
    }
  }

  protected onDragOver(event: DragEvent, index: number): void {
    if (this.dragIndex() === null) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropIndex.set(index);
  }

  protected onDrop(event: DragEvent, index: number): void {
    const from = this.dragIndex();
    event.preventDefault();
    this.onDragEnd();
    if (from === null || from === index) return;
    this.reorder.emit(moveStop(this.timelineItems(), from, index));
  }

  protected onDragEnd(): void {
    this.dragIndex.set(null);
    this.dropIndex.set(null);
  }
}

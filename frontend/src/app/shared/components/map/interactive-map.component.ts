import { 
  afterNextRender,
  Component, 
  DestroyRef,
  effect,
  ElementRef, 
  inject,
  input,
  signal,
  viewChild 
} from '@angular/core';
import * as L from 'leaflet';

export interface MapStopPoint {
  id: string;
  name: string;
  category: 'hotel' | 'activity' | 'food' | 'transport';
  lat: number;
  lng: number;
  address?: string;
  timeSlot?: string;
  details?: string;
}

@Component({
  selector: 'app-interactive-map',
  standalone: true,
  templateUrl: './interactive-map.component.html',
  styleUrl: './interactive-map.component.css'
})
export class InteractiveMapComponent {
  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');

  readonly stops = input<MapStopPoint[]>([]);
  readonly defaultCenter = input<[number, number]>([41.3851, 2.1734]); // Barcelona default
  readonly defaultZoom = input<number>(13);
  /** Dashed line connecting the stops in order (day itinerary); off for "points around a place" views. */
  readonly showRoute = input(true);
  readonly emptyMessage = input('Nessuna posizione geolocalizzata per questa giornata. Aggiungi tappe o hotel con indirizzo!');

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup = L.layerGroup();
  private routeLine: L.Polyline | null = null;
  private mapReady = signal(false);

  constructor() {
    afterNextRender(() => {
      this.initMap();
      this.mapReady.set(true);
    });

    // Re-render markers whenever the stops change (and once the map is ready)
    effect(() => {
      this.stops();
      this.showRoute();
      if (this.mapReady()) this.renderStops();
    });

    inject(DestroyRef).onDestroy(() => {
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
    });
  }

  private initMap(): void {
    if (this.map) return;

    this.map = L.map(this.mapContainer().nativeElement, {
      center: this.defaultCenter(),
      zoom: this.defaultZoom(),
      zoomControl: true,
      scrollWheelZoom: false // prevents accidental scroll on mobile while swiping
    });

    // Clean OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);
  }

  private renderStops(): void {
    if (!this.map) return;

    const stops = this.stops();
    this.markersLayer.clearLayers();
    if (this.routeLine) {
      this.routeLine.remove();
      this.routeLine = null;
    }

    if (!stops || stops.length === 0) {
      this.map.setView(this.defaultCenter(), this.defaultZoom());
      return;
    }

    const latLngs: [number, number][] = [];

    stops.forEach((stop, index) => {
      latLngs.push([stop.lat, stop.lng]);

      // Category Emoji
      let emoji = '📍';
      let markerClass = 'marker-activity';
      if (stop.category === 'hotel') {
        emoji = '🏨';
        markerClass = 'marker-hotel';
      } else if (stop.category === 'food') {
        emoji = '🍕';
        markerClass = 'marker-food';
      }

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="custom-map-marker ${markerClass}">
            <span>${emoji}</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -20]
      });

      const navQuery = encodeURIComponent(`${stop.name} ${stop.address || ''}`);
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${navQuery}`;

      const popupContent = `
        <div class="map-popup-card">
          <h4 class="popup-title">${index + 1}. ${stop.name}</h4>
          ${stop.timeSlot ? `<p style="color:#f97316;font-size:0.75rem;font-weight:700;margin:0 0 4px 0;">🕒 ${stop.timeSlot}</p>` : ''}
          ${stop.address ? `<p class="popup-address">📍 ${stop.address}</p>` : ''}
          ${stop.details ? `<p style="font-size:0.75rem;color:#475569;margin:0 0 6px 0;">💡 ${stop.details}</p>` : ''}
          <a href="${googleMapsUrl}" target="_blank" rel="noopener" class="popup-btn-nav">
            🚗 Apri Navigatore ➔
          </a>
        </div>
      `;

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon })
        .bindPopup(popupContent);

      this.markersLayer.addLayer(marker);
    });

    // Draw route polyline connecting the day's stops
    if (this.showRoute() && latLngs.length > 1) {
      this.routeLine = L.polyline(latLngs, {
        color: '#6366f1',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8'
      }).addTo(this.map);
    }

    // Auto-fit all bounds
    const bounds = L.latLngBounds(latLngs);
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }
}

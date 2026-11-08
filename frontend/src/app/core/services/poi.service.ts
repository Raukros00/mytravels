import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { GeoPoint } from '../models/trip.model';
import { ApiService } from './api.service';

/** Luogo suggerito (attrazione, locale, indirizzo) da OpenStreetMap, tramite il backend (Photon). */
export interface Poi {
  id: string | null;
  /** Nome del luogo, es. "Basílica de la Sagrada Família". */
  name: string;
  /** Indirizzo leggibile: via e civico, CAP e città, nazione. */
  address: string;
  lat: number;
  lng: number;
  /** Categoria OpenStreetMap, es. "museum", "place_of_worship". */
  category: string;
}

export interface PoiSearchResult {
  /** false se il backend non ha il servizio configurato: indirizzo a testo libero. */
  enabled: boolean;
  results: Poi[];
}

export const OSM_COPYRIGHT_LINK = 'https://www.openstreetmap.org/copyright';

@Injectable({ providedIn: 'root' })
export class PoiService {
  private readonly api = inject(ApiService);

  /** Luoghi che corrispondono al testo; con `near` (es. la destinazione del viaggio) i vicini prima. */
  search(query: string, near?: GeoPoint | null): Observable<PoiSearchResult> {
    return this.api.get<PoiSearchResult>('/api/v1/places/poi', {
      q: query,
      lat: near?.lat,
      lng: near?.lng,
      lang: 'it'
    });
  }
}

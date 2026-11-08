import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { GeoPoint } from '../models/trip.model';
import { ApiService } from './api.service';

/**
 * Luogo suggerito (attrazione, locale, indirizzo) tramite il backend: da Wikidata (monumenti con il nome
 * nella lingua dell'utente) o da OpenStreetMap (Photon).
 */
export interface Poi {
  id: string | null;
  /** Nome nella lingua dell'utente se noto (es. "Torre Eiffel"), altrimenti quello locale. */
  name: string;
  /** Nome locale, se diverso da `name`: es. "Tour Eiffel". */
  localName?: string | null;
  /** Indirizzo leggibile: via e civico, CAP e città, nazione (può essere vuoto). */
  address: string;
  lat: number;
  lng: number;
  /** Categoria OpenStreetMap, es. "museum", "place_of_worship". */
  category: string;
  /** Fonte: Wikidata o OpenStreetMap (Photon). */
  source?: 'wikidata' | 'osm';
}

export interface PoiSearchResult {
  /** false se il backend non ha il servizio configurato: indirizzo a testo libero. */
  enabled: boolean;
  results: Poi[];
}

export const OSM_COPYRIGHT_LINK = 'https://www.openstreetmap.org/copyright';
export const WIKIDATA_LINK = 'https://www.wikidata.org/';

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

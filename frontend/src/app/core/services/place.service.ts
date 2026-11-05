import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/** Città suggerita per la destinazione (GeoNames, tramite il backend). */
export interface Place {
  id: string;
  /** Nome in italiano, es. "Zurigo". */
  name: string;
  /** Nome locale/internazionale, es. "Zürich": usato per cercare le copertine. */
  intlName: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

export interface PlaceSearchResult {
  /** false se il backend non ha lo username GeoNames: destinazione a testo libero. */
  enabled: boolean;
  results: Place[];
}

export const GEONAMES_LINK = 'https://www.geonames.org/';

@Injectable({ providedIn: 'root' })
export class PlaceService {
  private readonly api = inject(ApiService);

  search(query: string): Observable<PlaceSearchResult> {
    return this.api.get<PlaceSearchResult>('/api/v1/places/search', { q: query });
  }
}

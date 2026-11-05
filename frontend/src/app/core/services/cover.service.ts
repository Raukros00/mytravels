import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/** Copertina suggerita (da Unsplash, tramite il backend). */
export interface CoverSuggestion {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  authorName: string;
  /** Profilo del fotografo su Unsplash (con utm_source, come richiesto dalle linee guida). */
  authorUrl: string;
  downloadLocation: string;
}

export interface CoverSearchResult {
  /** false se il backend non ha la chiave Unsplash: niente suggerimenti. */
  enabled: boolean;
  results: CoverSuggestion[];
}

/** Link a Unsplash da mostrare insieme al credito del fotografo. */
export const UNSPLASH_LINK = 'https://unsplash.com/?utm_source=wanderbite&utm_medium=referral';

@Injectable({ providedIn: 'root' })
export class CoverService {
  private readonly api = inject(ApiService);

  search(destination: string): Observable<CoverSearchResult> {
    return this.api.get<CoverSearchResult>('/api/v1/covers/search', { q: destination });
  }

  /** Va chiamato quando una foto suggerita viene usata davvero (linee guida Unsplash). */
  trackDownload(downloadLocation: string): void {
    this.api.post('/api/v1/covers/download', { downloadLocation }).subscribe({ error: () => undefined });
  }
}

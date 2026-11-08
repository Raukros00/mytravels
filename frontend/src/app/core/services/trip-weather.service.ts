import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { ApiService } from './api.service';
import { DayForecast } from '../utils/weather.utils';

/** Le previsioni restano in memoria per un'ora (il backend ha la sua cache verso Open-Meteo). */
const TTL_MS = 60 * 60 * 1000;

/**
 * Meteo di una giornata del viaggio (#111), da GET /api/v1/trips/:id/weather?date=yyyy-MM-dd
 * (Open-Meteo chiamato dal backend). Errori e previsioni non disponibili → `null`: la guida resta senza meteo.
 */
@Injectable({ providedIn: 'root' })
export class TripWeatherService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, { at: number; data: Observable<DayForecast | null> }>();

  forecast(tripId: string, date: string): Observable<DayForecast | null> {
    const key = `${tripId}|${date}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
    const data = this.api.get<DayForecast>(`/api/v1/trips/${tripId}/weather`, { date }).pipe(
      map(f => (f?.available && f.daily ? f : null)),
      catchError(() => {
        // Errore (rete, server): si riprova alla prossima apertura.
        this.cache.delete(key);
        return of(null);
      }),
      shareReplay(1)
    );
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }
}

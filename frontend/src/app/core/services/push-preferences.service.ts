import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Categorie di notifiche push (#97). */
export type PushCategory = 'invites' | 'proposals' | 'newMembers' | 'reminders' | 'liveGuide';
export type PushPreferences = Record<PushCategory, boolean>;

export const PUSH_CATEGORIES: readonly PushCategory[] = ['invites', 'proposals', 'newMembers', 'reminders', 'liveGuide'];

const API = '/api/v1/push/preferences';

/**
 * Preferenze delle notifiche push per tipo: salvate sul server per l'utente, quindi valide su tutti
 * i suoi dispositivi (non solo su questo).
 */
@Injectable({ providedIn: 'root' })
export class PushPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly prefsSignal = signal<PushPreferences | null>(null);
  private readonly savingSignal = signal<PushCategory | null>(null);
  readonly preferences = this.prefsSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();

  async load(): Promise<void> {
    try {
      this.prefsSignal.set(await firstValueFrom(this.http.get<PushPreferences>(API)));
    } catch {
      this.prefsSignal.set(null);
    }
  }

  /** Cambia una categoria (aggiornamento immediato, ripristinato se il salvataggio non riesce). */
  async set(category: PushCategory, enabled: boolean): Promise<boolean> {
    const before = this.prefsSignal();
    if (!before || this.savingSignal()) return false;
    this.prefsSignal.set({ ...before, [category]: enabled });
    this.savingSignal.set(category);
    try {
      this.prefsSignal.set(await firstValueFrom(this.http.put<PushPreferences>(API, { [category]: enabled })));
      return true;
    } catch {
      this.prefsSignal.set(before);
      return false;
    } finally {
      this.savingSignal.set(null);
    }
  }
}

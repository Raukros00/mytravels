import { DestroyRef, Injectable, inject, isDevMode, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Dove si può simulare l'orario: sviluppo, test e2e e ambiente di test. Mai in produzione. */
const SIMULATION_HOSTS = ['localhost', '127.0.0.1', 'test.alessandrodominici.dev'];
const SIMULATION_KEY = 'wb_simulated_now';
const TICK_MS = 30_000;

/**
 * Ora attuale per la modalità "In viaggio" (#103), aggiornata ogni 30 secondi.
 *
 * Simulazione (solo fuori produzione, vedi `SIMULATION_HOSTS`): aprendo una pagina con `?now=2026-07-03T10:30`
 * l'app fa finta che sia quell'ora locale; il tempo poi scorre normalmente. La scelta resta per la scheda del
 * browser (sessionStorage) finché non si apre una pagina con `?now=off`. In produzione il parametro viene ignorato.
 * Nei test e2e si può usare anche `cy.clock`, che sostituisce `Date`.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly document = inject(DOCUMENT);
  /** Differenza (ms) tra l'ora simulata e quella reale; 0 = nessuna simulazione. */
  private offsetMs = 0;
  private readonly nowSignal = signal(new Date());
  /** Ora attuale (o simulata). */
  readonly now = this.nowSignal.asReadonly();
  /** Vero se l'orario è simulato: la guida lo segnala. */
  readonly simulated = signal(false);

  constructor() {
    this.initSimulation();
    this.tick();
    const view = this.document.defaultView;
    if (view) {
      const timer = view.setInterval(() => this.tick(), TICK_MS);
      inject(DestroyRef).onDestroy(() => view.clearInterval(timer));
    }
  }

  /** Ricalcola subito l'ora (es. al ritorno sulla scheda). */
  tick(): void {
    this.nowSignal.set(new Date(Date.now() + this.offsetMs));
  }

  /** Vero se in questo ambiente si può simulare l'orario. */
  get simulationAllowed(): boolean {
    const host = this.document.location?.hostname ?? '';
    return isDevMode() || SIMULATION_HOSTS.includes(host);
  }

  private initSimulation(): void {
    if (!this.simulationAllowed) return;
    const storage = this.storage();
    const param = new URLSearchParams(this.document.location?.search ?? '').get('now');
    let target: string | null = null;
    if (param === 'off') storage?.removeItem(SIMULATION_KEY);
    else if (param && parseLocalDateTime(param)) {
      // Si salva lo scarto dall'ora reale, così l'orario simulato continua a scorrere anche ricaricando.
      const offset = parseLocalDateTime(param)!.getTime() - Date.now();
      storage?.setItem(SIMULATION_KEY, String(offset));
      target = param;
    }
    const saved = Number(storage?.getItem(SIMULATION_KEY));
    if (target || (Number.isFinite(saved) && saved !== 0)) {
      this.offsetMs = target ? parseLocalDateTime(target)!.getTime() - Date.now() : saved;
      this.simulated.set(true);
    }
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.sessionStorage ?? null;
    } catch {
      return null;
    }
  }
}

/** `yyyy-MM-ddTHH:mm` (o solo `yyyy-MM-dd`, alle 09:00) come ora LOCALE; `null` se non valido. */
export function parseLocalDateTime(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = [m[1], m[2], m[3], m[4] ?? '09', m[5] ?? '00'].map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && h < 24 && mi < 60 ? date : null;
}

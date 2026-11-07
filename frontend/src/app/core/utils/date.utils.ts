/**
 * Date "di calendario" (yyyy-MM-dd) calcolate sull'ora LOCALE del dispositivo.
 *
 * Non usare `new Date().toISOString().split('T')[0]` per ottenere la data di oggi: `toISOString()`
 * è in UTC, quindi in Italia tra mezzanotte e l'01:00 (02:00 con l'ora legale) restituisce ieri.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** Data locale `yyyy-MM-dd` di `date` (anno, mese e giorno come li vede l'utente). */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Data locale di oggi, `yyyy-MM-dd`. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * Somma `days` giorni (anche negativi) a una data `yyyy-MM-dd`.
 * Il calcolo usa solo anno/mese/giorno in UTC, quindi non risente di fuso orario e ora legale.
 */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Data locale `yyyy-MM-dd` di `years` anni fa rispetto a `now`. */
export function isoYearsAgo(years: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - years);
  return toIsoDate(d);
}

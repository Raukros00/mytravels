/**
 * Meteo della giornata nella guida "In viaggio" (#111): funzioni pure su previsioni Open-Meteo
 * (codici meteo WMO, ore locali della destinazione "HH:mm").
 */

export interface WeatherHour {
  time: string;
  temperature: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  weatherCode: number | null;
}

export interface DayForecast {
  available: boolean;
  date: string;
  timezone?: string | null;
  daily: {
    weatherCode: number | null;
    temperatureMax: number | null;
    temperatureMin: number | null;
    precipitationProbabilityMax: number | null;
    precipitationSum: number | null;
  } | null;
  hourly: WeatherHour[];
}

/** Pioggia nel resto della giornata: niente, già in corso (fino a `until`, se smette) o a partire da `from`. */
export type RainOutlook =
  | { kind: 'none' }
  | { kind: 'now'; until: string | null }
  | { kind: 'later'; from: string };

/** Probabilità oltre la quale un'ora è considerata "di pioggia" anche senza un codice di pioggia. */
const RAIN_PROBABILITY = 50;
/** Categorie delle attività che si fanno all'aperto (monumenti visti da fuori, parchi, natura). */
const OUTDOOR_ACTIVITY_CATEGORIES = new Set(['monument', 'nature']);

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Icona e descrizione di un codice meteo WMO; di notte sole e poche nuvole diventano luna. */
export function weatherInfo(code: number | null | undefined, night = false): { icon: string; label: string } {
  if (code == null) return { icon: '🌡️', label: 'Meteo' };
  if (code === 0) return { icon: night ? '🌙' : '☀️', label: 'Sereno' };
  if (code === 1) return { icon: night ? '🌙' : '🌤️', label: 'Poco nuvoloso' };
  if (code === 2) return { icon: '⛅', label: 'Parzialmente nuvoloso' };
  if (code === 3) return { icon: '☁️', label: 'Nuvoloso' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: 'Nebbia' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: 'Pioviggine' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: 'Pioggia' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', label: 'Neve' };
  if (code >= 95) return { icon: '⛈️', label: 'Temporale' };
  return { icon: '🌡️', label: 'Meteo' };
}

/** Pioggia, pioviggine, neve o temporale (codice WMO), oppure probabilità di precipitazioni alta. */
export function isWetHour(hour: WeatherHour): boolean {
  const code = hour.weatherCode;
  if (code != null && code >= 51) return true;
  return (hour.precipitationProbability ?? 0) >= RAIN_PROBABILITY && (hour.precipitation ?? 1) > 0;
}

/** Pioggia da adesso (`nowMinutes`, minuti dalla mezzanotte) alla fine della giornata. */
export function rainOutlook(hourly: WeatherHour[], nowMinutes: number): RainOutlook {
  const currentHour = Math.floor(nowMinutes / 60) * 60;
  const rest = hourly.filter(h => minutes(h.time) >= currentHour).sort((a, b) => minutes(a.time) - minutes(b.time));
  if (!rest.length) return { kind: 'none' };
  if (isWetHour(rest[0])) {
    const dry = rest.find(h => !isWetHour(h));
    return { kind: 'now', until: dry ? dry.time : null };
  }
  const wet = rest.find(isWetHour);
  return wet ? { kind: 'later', from: wet.time } : { kind: 'none' };
}

/** L'ora delle previsioni in corso (`nowMinutes`), se c'è. */
export function hourAt(hourly: WeatherHour[], nowMinutes: number): WeatherHour | null {
  const currentHour = Math.floor(nowMinutes / 60) * 60;
  return hourly.find(h => minutes(h.time) === currentHour) ?? null;
}

/** Tappa che si fa all'aperto: attività di categoria monumento o natura. Ristoranti e musei sono al coperto. */
export function isOutdoorStop(type: 'activity' | 'food', category: string | null | undefined): boolean {
  return type === 'activity' && !!category && OUTDOOR_ACTIVITY_CATEGORIES.has(category);
}

/** Tappa della giornata per il suggerimento in caso di pioggia. */
export interface RainStopInput {
  name: string;
  outdoor: boolean;
  times: { start: string; end: string | null } | null;
  done: boolean;
  skipped: boolean;
}

export interface RainAdvice {
  text: string;
  /** Tappe all'aperto che finirebbero sotto la pioggia. */
  stops: string[];
}

/**
 * Suggerimento in caso di pioggia: le tappe all'aperto ancora da fare che cadrebbero sotto la pioggia
 * (senza orario, o che finiscono dopo l'inizio della pioggia) vanno anticipate. `null` se non serve.
 */
export function rainAdvice(stops: RainStopInput[], outlook: RainOutlook, nowMinutes: number): RainAdvice | null {
  if (outlook.kind === 'none') return null;
  const rainFrom = outlook.kind === 'later' ? minutes(outlook.from) : nowMinutes;
  const affected = stops.filter(s => {
    if (!s.outdoor || s.done || s.skipped) return false;
    if (!s.times) return true;
    const end = s.times.end ? minutes(s.times.end) : minutes(s.times.start) + 60;
    return end > nowMinutes && end > rainFrom;
  }).map(s => s.name);
  if (!affected.length) return null;
  const list = affected.join(', ');
  if (outlook.kind === 'now') {
    const until = outlook.until ? ` (fino alle ${hourLabel(outlook.until)} circa)` : '';
    return { text: `Sta piovendo${until}: se puoi, fai prima le tappe al coperto e rimanda quelle all'aperto: ${list}.`, stops: affected };
  }
  return {
    text: `Dalle ${hourLabel(outlook.from)} è prevista pioggia: meglio fare prima le tappe all'aperto: ${list}.`,
    stops: affected
  };
}

/** "16:00" → "16", "16:30" → "16:30". */
export function hourLabel(hhmm: string): string {
  return hhmm.endsWith(':00') ? String(Number(hhmm.slice(0, 2))) : hhmm;
}

/** Testo breve per l'intestazione: "pioggia dalle 16:00", "pioggia in corso", "niente pioggia". */
export function rainLabel(outlook: RainOutlook): string {
  if (outlook.kind === 'later') return `pioggia dalle ${outlook.from}`;
  if (outlook.kind === 'now') return outlook.until ? `pioggia fino alle ${outlook.until}` : 'pioggia in corso';
  return 'niente pioggia';
}

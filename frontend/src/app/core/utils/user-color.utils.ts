/**
 * Colori degli utenti (#122). Il colore non è più un dato del profilo: il backend lo assegna in automatico
 * dall'id con questa tavolozza (`UserColors.PALETTE`, da tenere allineata) e l'utente può cambiarlo solo
 * come sfondo dell'avatar emoji. Tinte scure e distinte, tutte con contrasto ≥ 4.5:1 sul testo bianco.
 */
export const USER_COLOR_PALETTE = [
  '#1d4ed8', '#c2410c', '#047857', '#be123c', '#7c3aed',
  '#0e7490', '#a21caf', '#3f6212', '#334155'
] as const;

/** Colore neutro per chi non ha un colore valido. */
export const FALLBACK_USER_COLOR = '#6b7280';

function parseHex(color: string | undefined | null): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((color ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Distanza percettiva approssimata tra due colori (RGB pesato, "redmean"): 0 = uguali, ~765 = opposti.
 * Colori non validi sono considerati uguali tra loro.
 */
export function colorDistance(a: string | undefined | null, b: string | undefined | null): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return ca === cb ? 0 : 765;
  const rMean = (ca[0] + cb[0]) / 2;
  const dr = ca[0] - cb[0];
  const dg = ca[1] - cb[1];
  const db = ca[2] - cb[2];
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

/** Sotto questa distanza due persone dello stesso gruppo si confonderebbero (es. due verdi simili). */
export const MIN_COLOR_DISTANCE = 90;

/**
 * Colori **solo per la visualizzazione** dei membri di un gruppo (spese, grafici): ognuno tiene il proprio
 * colore, tranne chi l'ha troppo simile a un membro precedente nell'elenco, che riceve il primo colore
 * della tavolozza abbastanza diverso da quelli già usati. Restituisce `id → colore`.
 * Ordine stabile: a parità di elenco i colori non cambiano tra una visita e l'altra.
 */
export function distinctMemberColors(members: readonly { id: string; color?: string | null }[]): Map<string, string> {
  const result = new Map<string, string>();
  const used: string[] = [];
  const farFromUsed = (c: string) => used.every(u => colorDistance(u, c) >= MIN_COLOR_DISTANCE);
  for (const m of members) {
    const own = parseHex(m.color) ? m.color!.toLowerCase() : null;
    let chosen = own && farFromUsed(own) ? own : null;
    if (!chosen) chosen = USER_COLOR_PALETTE.find(farFromUsed) ?? own ?? FALLBACK_USER_COLOR;
    used.push(chosen);
    result.set(m.id, chosen);
  }
  return result;
}

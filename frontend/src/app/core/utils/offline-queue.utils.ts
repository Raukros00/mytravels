/**
 * Coda delle modifiche fatte offline (#109): funzioni pure per accodare, unire e riapplicare le azioni.
 * Le azioni riguardano gli elementi del viaggio con un endpoint proprio (attività, ristoranti, spese):
 * Fatto / Salta nella guida e le spese.
 */

export type QueueCollection = 'activities' | 'placesToEat' | 'expenses';
export type QueueOp = 'create' | 'update' | 'delete';

export interface QueuedAction {
  /** Id dell'azione (solo locale). */
  id: string;
  tripId: string;
  collection: QueueCollection;
  op: QueueOp;
  /** Id dell'elemento: quello del server, o quello locale per un elemento creato offline. */
  itemId: string;
  /** Elemento completo (create/update): l'ultima versione vince. */
  body?: Record<string, unknown>;
  /** Nome leggibile dell'elemento, per gli avvisi. */
  label: string;
  queuedAt: number;
}

const sameItem = (a: QueuedAction, b: Pick<QueuedAction, 'tripId' | 'collection' | 'itemId'>) =>
  a.tripId === b.tripId && a.collection === b.collection && a.itemId === b.itemId;

/**
 * Aggiunge `action` alla coda unendola a quella già presente per lo stesso elemento ("l'ultima azione vince"):
 * - creazione + modifica → creazione con i dati nuovi;
 * - creazione + eliminazione → niente (l'elemento non è mai arrivato al server);
 * - modifica + modifica → l'ultima modifica;
 * - modifica + eliminazione → eliminazione;
 * - eliminazione + altro → resta l'eliminazione.
 */
export function enqueueAction(queue: readonly QueuedAction[], action: QueuedAction): QueuedAction[] {
  const index = queue.findIndex(a => sameItem(a, action));
  if (index < 0) return [...queue, action];
  const previous = queue[index];
  const rest = queue.filter((_, i) => i !== index);
  if (previous.op === 'delete') return [...queue];
  if (previous.op === 'create') {
    if (action.op === 'delete') return rest;
    const merged: QueuedAction = { ...previous, body: { ...previous.body, ...action.body }, label: action.label, queuedAt: action.queuedAt };
    return queue.map((a, i) => (i === index ? merged : a));
  }
  // previous = update: si sostituisce mantenendo la posizione (l'ordine delle azioni non conta tra elementi diversi).
  const next: QueuedAction = action.op === 'delete'
    ? { ...action, id: previous.id, body: undefined }
    : { ...action, id: previous.id, op: 'update', body: { ...previous.body, ...action.body } };
  return queue.map((a, i) => (i === index ? next : a));
}

/** Vero se l'elemento è stato creato offline e non è ancora arrivato al server. */
export function hasPendingCreate(queue: readonly QueuedAction[], tripId: string, collection: QueueCollection, itemId: string): boolean {
  return queue.some(a => a.op === 'create' && sameItem(a, { tripId, collection, itemId }));
}

/** Richiesta fallita per mancanza di rete: status 0 (nessuna risposta) o 504 del service worker/proxy offline. */
export function isNetworkError(status: number | null | undefined): boolean {
  return status === 0 || status === 504 || status == null;
}

/**
 * Cosa fare quando l'invio di un'azione fallisce:
 * - `retry`: rete assente o server momentaneamente non disponibile → si riprova più tardi, la coda si ferma;
 * - `stop`: sessione scaduta (401) → si riprova dopo un nuovo accesso;
 * - `reject`: il server rifiuta la modifica (es. 404 elemento eliminato da un altro membro, 400, 403, 409)
 *   → l'azione si scarta e l'utente viene avvisato.
 */
export function failureAction(status: number | null | undefined): 'retry' | 'stop' | 'reject' {
  if (isNetworkError(status) || status === 408 || status === 429 || (status ?? 0) >= 500) return 'retry';
  if (status === 401) return 'stop';
  return 'reject';
}

interface WithId { id: string }

/**
 * La copia del viaggio arrivata dal server (o dalla cache) con sopra le azioni ancora in coda: le modifiche fatte
 * offline restano visibili finché non sono state inviate.
 */
export function applyPending<T extends { id: string; activities?: WithId[]; placesToEat?: WithId[]; expenses?: WithId[] }>(
  trip: T, queue: readonly QueuedAction[]
): T {
  const mine = queue.filter(a => a.tripId === trip.id);
  if (!mine.length) return trip;
  const result = { ...trip };
  for (const collection of ['activities', 'placesToEat', 'expenses'] as const) {
    const actions = mine.filter(a => a.collection === collection);
    if (!actions.length) continue;
    let items = [...((trip[collection] ?? []) as WithId[])];
    for (const a of actions) {
      if (a.op === 'delete') items = items.filter(i => i.id !== a.itemId);
      else if (a.op === 'update') items = items.map(i => (i.id === a.itemId ? { ...i, ...a.body, id: i.id } : i));
      else if (!items.some(i => i.id === a.itemId)) items.push({ ...(a.body ?? {}), id: a.itemId });
    }
    (result as Record<string, unknown>)[collection] = items;
  }
  return result;
}

/** "1 modifica in attesa di sincronizzazione", "3 modifiche in attesa di sincronizzazione". */
export function pendingLabel(count: number): string {
  return count === 1 ? '1 modifica in attesa di sincronizzazione' : `${count} modifiche in attesa di sincronizzazione`;
}

/** "09:12" dall'istante indicato (ora locale). */
export function clockLabel(at: number | Date): string {
  const d = typeof at === 'number' ? new Date(at) : at;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

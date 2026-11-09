import {
  QueuedAction,
  applyPending,
  clockLabel,
  enqueueAction,
  failureAction,
  hasPendingCreate,
  isNetworkError,
  pendingLabel
} from './offline-queue.utils';

let n = 0;
function action(op: QueuedAction['op'], itemId: string, body?: Record<string, unknown>, extra: Partial<QueuedAction> = {}): QueuedAction {
  return { id: `q${++n}`, tripId: 't1', collection: 'activities', op, itemId, body, label: String(body?.['name'] ?? itemId), queuedAt: n, ...extra };
}

describe('offline-queue.utils', () => {
  describe('enqueueAction', () => {
    it('elementi diversi: in coda nell\'ordine', () => {
      const q = enqueueAction(enqueueAction([], action('update', 'a', { isCompleted: true })), action('update', 'b', { isSkipped: true }));
      expect(q.map(a => a.itemId)).toEqual(['a', 'b']);
    });

    it('modifica + modifica: vince l\'ultima', () => {
      const q = enqueueAction(
        [action('update', 'a', { isCompleted: true, isSkipped: false })],
        action('update', 'a', { isCompleted: false, isSkipped: true })
      );
      expect(q.length).toBe(1);
      expect(q[0].body).toEqual({ isCompleted: false, isSkipped: true });
    });

    it('creazione + modifica: creazione con i dati nuovi; creazione + eliminazione: niente', () => {
      const created = [action('create', 'exp_1', { title: 'Caffè', amount: 2 }, { collection: 'expenses' })];
      const updated = enqueueAction(created, action('update', 'exp_1', { amount: 3 }, { collection: 'expenses' }));
      expect(updated.length).toBe(1);
      expect(updated[0].op).toBe('create');
      expect(updated[0].body).toEqual({ title: 'Caffè', amount: 3 });
      expect(enqueueAction(updated, action('delete', 'exp_1', undefined, { collection: 'expenses' }))).toEqual([]);
    });

    it('modifica + eliminazione: eliminazione; eliminazione + altro: resta l\'eliminazione', () => {
      const q = enqueueAction([action('update', 'a', { isCompleted: true })], action('delete', 'a'));
      expect(q.length).toBe(1);
      expect(q[0].op).toBe('delete');
      expect(q[0].body).toBeUndefined();
      expect(enqueueAction(q, action('update', 'a', { isCompleted: false }))[0].op).toBe('delete');
    });

    it('stesso id in viaggi o liste diverse: azioni distinte', () => {
      const q = enqueueAction([action('update', 'a', {})], action('update', 'a', {}, { collection: 'placesToEat' }));
      expect(q.length).toBe(2);
    });
  });

  it('hasPendingCreate', () => {
    const q = [action('create', 'exp_1', {}, { collection: 'expenses' })];
    expect(hasPendingCreate(q, 't1', 'expenses', 'exp_1')).toBeTrue();
    expect(hasPendingCreate(q, 't1', 'activities', 'exp_1')).toBeFalse();
    expect(hasPendingCreate(q, 't2', 'expenses', 'exp_1')).toBeFalse();
  });

  it('errori di rete e risposte del server', () => {
    expect(isNetworkError(0)).toBeTrue();
    expect(isNetworkError(504)).toBeTrue();
    expect(isNetworkError(404)).toBeFalse();
    expect(failureAction(0)).toBe('retry');
    expect(failureAction(503)).toBe('retry');
    expect(failureAction(429)).toBe('retry');
    expect(failureAction(401)).toBe('stop');
    expect(failureAction(404)).toBe('reject');
    expect(failureAction(409)).toBe('reject');
    expect(failureAction(400)).toBe('reject');
  });

  describe('applyPending', () => {
    const trip = () => ({
      id: 't1',
      activities: [{ id: 'a', name: 'Duomo', isCompleted: false }, { id: 'b', name: 'Mole', isCompleted: false }],
      expenses: [{ id: 'e1', title: 'Treno' }]
    });

    it('riapplica modifiche, eliminazioni e creazioni in coda alla copia del server', () => {
      const q = [
        action('update', 'a', { name: 'Duomo', isCompleted: true }),
        action('delete', 'b'),
        action('create', 'exp_9', { title: 'Gelato' }, { collection: 'expenses' })
      ];
      const t = applyPending(trip(), q);
      expect(t.activities).toEqual([{ id: 'a', name: 'Duomo', isCompleted: true }]);
      expect(t.expenses.map(e => e.id)).toEqual(['e1', 'exp_9']);
    });

    it('ignora le azioni di altri viaggi e non cambia il viaggio senza azioni', () => {
      const original = trip();
      expect(applyPending(original, [action('delete', 'a', undefined, { tripId: 't2' })])).toBe(original);
    });

    it('creazione già arrivata (stesso id): niente doppioni', () => {
      const t = applyPending(trip(), [action('create', 'e1', { title: 'Treno' }, { collection: 'expenses' })]);
      expect(t.expenses.length).toBe(1);
    });
  });

  it('etichette', () => {
    expect(pendingLabel(1)).toBe('1 modifica in attesa di sincronizzazione');
    expect(pendingLabel(3)).toBe('3 modifiche in attesa di sincronizzazione');
    expect(clockLabel(new Date(2030, 6, 3, 9, 5))).toBe('09:05');
  });
});

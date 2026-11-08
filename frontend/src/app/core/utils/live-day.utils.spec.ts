import { LiveStopInput, computeLiveDay, daysBetweenIso, effectiveEnds, tripDayDate, tripDayInfo } from './live-day.utils';

function stop(id: string, start?: string, end?: string, extra: Partial<LiveStopInput> = {}): LiveStopInput {
  return { id, times: start ? { start, end: end ?? null } : null, done: false, skipped: false, ...extra };
}

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Giornata tipo: Duomo 09:00–11:00, pranzo 12:30–14:00, Museo 15:00 (senza fine), Passeggiata senza orario. */
const day = () => [
  stop('duomo', '09:00', '11:00'),
  stop('pranzo', '12:30', '14:00'),
  stop('museo', '15:00'),
  stop('passeggiata')
];

describe('live-day.utils', () => {
  describe('effectiveEnds', () => {
    it('usa la fine impostata, poi l\'inizio della tappa successiva, poi un\'ora', () => {
      expect(effectiveEnds([stop('a', '09:00', '10:00'), stop('b', '10:30'), stop('c'), stop('d', '12:00'), stop('e', '18:00')]))
        .toEqual([at('10:00'), at('12:00'), null, at('18:00'), at('19:00')]);
    });
  });

  describe('computeLiveDay', () => {
    it('giornata vuota', () => {
      const s = computeLiveDay([], at('10:00'));
      expect(s.phase).toBe('empty');
      expect(s.focus).toBeNull();
    });

    it('prima della prima tappa: la prossima è la prima, con i minuti che mancano', () => {
      const s = computeLiveDay(day(), at('08:15'));
      expect(s.phase).toBe('before');
      expect(s.focus?.id).toBe('duomo');
      expect(s.focusKind).toBe('next');
      expect(s.minutesToFocus).toBe(45);
      expect(s.upNext.map(x => x.id)).toEqual(['pranzo', 'museo']);
    });

    it('durante una tappa: adesso è quella, dopo le due successive', () => {
      const s = computeLiveDay(day(), at('10:30'));
      expect(s.phase).toBe('during');
      expect(s.focus?.id).toBe('duomo');
      expect(s.focusKind).toBe('current');
      expect(s.minutesToFocus).toBeNull();
      expect(s.statuses.get('duomo')).toBe('current');
      expect(s.statuses.get('pranzo')).toBe('todo');
    });

    it('tra due tappe: adesso è la prossima; quella passata e non segnata è "missed"', () => {
      const s = computeLiveDay(day(), at('11:30'));
      expect(s.phase).toBe('during');
      expect(s.focus?.id).toBe('pranzo');
      expect(s.focusKind).toBe('next');
      expect(s.minutesToFocus).toBe(60);
      expect(s.statuses.get('duomo')).toBe('missed');
    });

    it('le tappe fatte o saltate escono dal flusso', () => {
      const stops = day();
      stops[0].done = true;
      stops[1].skipped = true;
      const s = computeLiveDay(stops, at('10:00'));
      expect(s.focus?.id).toBe('museo');
      expect(s.focusKind).toBe('next');
      expect(s.phase).toBe('during');
      expect(s.statuses.get('duomo')).toBe('done');
      expect(s.statuses.get('pranzo')).toBe('skipped');
      expect(s.upNext.map(x => x.id)).toEqual(['passeggiata']);
      expect(s.doneCount).toBe(1);
      expect(s.skippedCount).toBe(1);
      expect(s.remaining.map(x => x.id)).toEqual(['museo', 'passeggiata']);
    });

    it('una tappa senza fine dura fino all\'inizio della successiva', () => {
      const s = computeLiveDay([stop('a', '09:00'), stop('b', '13:00', '14:00')], at('12:00'));
      expect(s.focus?.id).toBe('a');
      expect(s.focusKind).toBe('current');
    });

    it('una tappa senza orario non scade: arriva il suo turno dopo le tappe passate', () => {
      const s = computeLiveDay(day(), at('17:00'));
      expect(s.focus?.id).toBe('passeggiata');
      expect(s.focusKind).toBe('current');
      expect(s.statuses.get('museo')).toBe('missed');
    });

    it('dopo l\'ultima tappa: giornata finita, con le tappe rimaste da recuperare', () => {
      const stops = [stop('a', '09:00', '10:00', { done: true }), stop('b', '11:00', '12:00')];
      const s = computeLiveDay(stops, at('20:00'));
      expect(s.phase).toBe('finished');
      expect(s.focus).toBeNull();
      expect(s.statuses.get('b')).toBe('missed');
      expect(s.remaining.map(x => x.id)).toEqual(['b']);
    });

    it('tutte fatte: giornata finita anche se è presto', () => {
      const stops = [stop('a', '09:00', '10:00', { done: true }), stop('b', undefined, undefined, { done: true })];
      expect(computeLiveDay(stops, at('08:00')).phase).toBe('finished');
    });
  });

  describe('giorni del viaggio', () => {
    it('daysBetweenIso attraversa mesi e cambi d\'ora', () => {
      expect(daysBetweenIso('2026-03-28', '2026-03-30')).toBe(2);
      expect(daysBetweenIso('2026-10-24', '2026-10-26')).toBe(2);
      expect(daysBetweenIso('2026-12-31', '2027-01-01')).toBe(1);
      expect(daysBetweenIso('2026-07-05', '2026-07-03')).toBe(-2);
    });

    it('tripDayInfo: prima, durante (ultimo giorno compreso) e dopo', () => {
      expect(tripDayInfo('2026-07-03', '2026-07-07', '2026-07-01')).toEqual(
        { state: 'before', dayNumber: -1, totalDays: 5, daysToStart: 2, isLastDay: false });
      expect(tripDayInfo('2026-07-03', '2026-07-07', '2026-07-05')).toEqual(
        { state: 'during', dayNumber: 3, totalDays: 5, daysToStart: 0, isLastDay: false });
      expect(tripDayInfo('2026-07-03', '2026-07-07', '2026-07-07').isLastDay).toBeTrue();
      expect(tripDayInfo('2026-07-03', '2026-07-07', '2026-07-08').state).toBe('after');
    });

    it('tripDayDate', () => {
      expect(tripDayDate('2026-07-30', 3)).toBe('2026-08-01');
    });
  });
});

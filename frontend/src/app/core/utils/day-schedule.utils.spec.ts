import {
  ScheduleStop,
  effectiveTimes,
  findOverlaps,
  formatTimeRange,
  isValidTime,
  moveStop,
  parseTimeSlot,
  sortDayStops,
  timesOverlap,
  toMinutes,
  validateTimeRange
} from './day-schedule.utils';

function stop(id: string, extra: Partial<ScheduleStop> = {}): ScheduleStop {
  return { id, name: id, ...extra };
}

const ids = (list: ScheduleStop[]) => list.map(s => s.id);

describe('day-schedule.utils', () => {
  describe('parseTimeSlot', () => {
    it('riconosce le fasce scritte a mano', () => {
      expect(parseTimeSlot('10:00 - 12:30')).toEqual({ start: '10:00', end: '12:30' });
      expect(parseTimeSlot('10.00-12.30')).toEqual({ start: '10:00', end: '12:30' });
      expect(parseTimeSlot('9:30')).toEqual({ start: '09:30', end: null });
      expect(parseTimeSlot(' 13:00 – 14:00 ')).toEqual({ start: '13:00', end: '14:00' });
      expect(parseTimeSlot('20:30—22:00')).toEqual({ start: '20:30', end: '22:00' });
    });

    it('scarta una fine non successiva all\'inizio, tenendo l\'inizio', () => {
      expect(parseTimeSlot('22:00 - 01:00')).toEqual({ start: '22:00', end: null });
      expect(parseTimeSlot('10:00 - 10:00')).toEqual({ start: '10:00', end: null });
    });

    it('non riconosce testo libero né orari impossibili', () => {
      for (const slot of ['mattina', '', null, undefined, '25:00', '10:75', '10:00 - 24:10', 'dalle 10:00', '10', '10:00 - 12']) {
        expect(parseTimeSlot(slot)).withContext(String(slot)).toBeNull();
      }
    });
  });

  it('isValidTime, toMinutes e formatTimeRange', () => {
    expect(isValidTime('09:05')).toBeTrue();
    expect(isValidTime('9:05')).toBeFalse();
    expect(isValidTime('24:00')).toBeFalse();
    expect(toMinutes('01:30')).toBe(90);
    expect(toMinutes('x')).toBeNaN();
    expect(formatTimeRange('10:00', '12:00')).toBe('10:00–12:00');
    expect(formatTimeRange('10:00')).toBe('10:00');
  });

  it('validateTimeRange', () => {
    expect(validateTimeRange('', '')).toBeNull();
    expect(validateTimeRange('10:00', '')).toBeNull();
    expect(validateTimeRange('10:00', '11:00')).toBeNull();
    expect(validateTimeRange('', '11:00')).toContain('inizio');
    expect(validateTimeRange('11:00', '10:00')).toContain('dopo');
    expect(validateTimeRange('11:00', '11:00')).toContain('dopo');
  });

  describe('effectiveTimes', () => {
    it('gli orari impostati prevalgono sul testo libero', () => {
      expect(effectiveTimes(stop('a', { startTime: '09:00', endTime: '10:00', timeSlot: '15:00' })))
        .toEqual({ start: '09:00', end: '10:00', source: 'set' });
    });

    it('senza orari usa la fascia riconoscibile', () => {
      expect(effectiveTimes(stop('a', { timeSlot: '15:00 - 17:00' }))).toEqual({ start: '15:00', end: '17:00', source: 'slot' });
    });

    it('pranzo e cena senza orario hanno l\'orario indicativo; gli altri pasti no', () => {
      expect(effectiveTimes(stop('p', { assignedMeal: 'lunch' }))).toEqual({ start: '12:30', end: '14:00', source: 'meal-default' });
      expect(effectiveTimes(stop('c', { assignedMeal: 'dinner', timeSlot: 'dopo il tramonto' })))
        .toEqual({ start: '20:00', end: '21:30', source: 'meal-default' });
      expect(effectiveTimes(stop('b', { assignedMeal: 'breakfast' }))).toBeNull();
      expect(effectiveTimes(stop('x'))).toBeNull();
    });
  });

  describe('sortDayStops', () => {
    it('senza ordine scelto: per orario, pasti compresi, poi le tappe senza orario', () => {
      const list = [
        stop('cena', { assignedMeal: 'dinner' }),
        stop('libera'),
        stop('pomeriggio', { startTime: '15:00' }),
        stop('pranzo', { assignedMeal: 'lunch' }),
        stop('mattina', { timeSlot: '10:00 - 12:00' })
      ];
      expect(ids(sortDayStops(list))).toEqual(['mattina', 'pranzo', 'pomeriggio', 'cena', 'libera']);
      expect(ids(list)[0]).toBe('cena'); // l'array originale non cambia
    });

    it('l\'ordine scelto prevale sull\'orario', () => {
      const list = [
        stop('a', { startTime: '09:00', dayOrder: 1 }),
        stop('b', { startTime: '18:00', dayOrder: 0 })
      ];
      expect(ids(sortDayStops(list))).toEqual(['b', 'a']);
    });

    it('le tappe senza ordine si inseriscono tra quelle ordinate in base all\'orario', () => {
      const list = [
        stop('a', { startTime: '09:00', dayOrder: 0 }),
        stop('senzaOra', { dayOrder: 1 }),
        stop('c', { startTime: '16:00', dayOrder: 2 }),
        stop('pranzo', { assignedMeal: 'lunch' }),
        stop('nuova')
      ];
      expect(ids(sortDayStops(list))).toEqual(['a', 'senzaOra', 'pranzo', 'c', 'nuova']);
    });
  });

  describe('sovrapposizioni', () => {
    it('timesOverlap', () => {
      expect(timesOverlap({ start: '10:00', end: '12:00' }, { start: '11:00', end: '13:00' })).toBeTrue();
      expect(timesOverlap({ start: '10:00', end: '12:00' }, { start: '12:00', end: '13:00' })).toBeFalse();
      expect(timesOverlap({ start: '10:00', end: null }, { start: '10:00', end: null })).toBeTrue();
      expect(timesOverlap({ start: '11:00', end: null }, { start: '10:00', end: '12:00' })).toBeTrue();
      expect(timesOverlap({ start: '12:00', end: null }, { start: '10:00', end: '12:00' })).toBeFalse();
    });

    it('findOverlaps segnala entrambe le tappe, compreso il pranzo indicativo', () => {
      const list = [
        stop('museo', { startTime: '11:00', endTime: '13:00' }),
        stop('pranzo', { assignedMeal: 'lunch' }),
        stop('parco', { startTime: '15:00', endTime: '16:00' }),
        stop('libera')
      ];
      const overlaps = findOverlaps(list);
      expect(ids(overlaps.get('museo')!)).toEqual(['pranzo']);
      expect(ids(overlaps.get('pranzo')!)).toEqual(['museo']);
      expect(overlaps.has('parco')).toBeFalse();
      expect(overlaps.has('libera')).toBeFalse();
    });
  });

  it('moveStop sposta senza modificare l\'originale e resta negli estremi', () => {
    const list = ['a', 'b', 'c'];
    expect(moveStop(list, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveStop(list, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveStop(list, 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveStop(list, 2, 5)).toEqual(['a', 'b', 'c']);
    expect(list).toEqual(['a', 'b', 'c']);
  });
});

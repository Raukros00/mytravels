import {
  CandidateDay,
  buildDayOptions,
  dayLoad,
  freeSlots,
  needsRecovery,
  parseClosingDays,
  parseOpeningHours,
  placeInSlots,
  recommendDay,
  stopDuration,
  weekdayOf
} from './reschedule.utils';

const r = (start: string, end: string | null = null) => ({ start, end });

describe('reschedule.utils', () => {
  describe('needsRecovery', () => {
    it('saltata (anche oggi o in un giorno futuro) o non fatta in un giorno passato', () => {
      expect(needsRecovery({ assignedDay: 3, done: false, skipped: true }, 2)).toBeTrue();
      expect(needsRecovery({ assignedDay: 1, done: false, skipped: false }, 2)).toBeTrue();
      expect(needsRecovery({ assignedDay: 2, done: false, skipped: false }, 2)).toBeFalse();
      expect(needsRecovery({ assignedDay: 1, done: true, skipped: false }, 2)).toBeFalse();
      expect(needsRecovery({ assignedDay: null, done: false, skipped: true }, 2)).toBeFalse();
      // Prima della partenza (giorno 0) niente da recuperare se non le saltate.
      expect(needsRecovery({ assignedDay: 1, done: false, skipped: false }, 0)).toBeFalse();
    });
  });

  describe('parseClosingDays', () => {
    it('riconosce i giorni in italiano e inglese, anche abbreviati e accentati', () => {
      expect([...parseClosingDays('Lunedì')]).toEqual([1]);
      expect([...parseClosingDays('chiuso lun e mar')].sort()).toEqual([1, 2]);
      expect([...parseClosingDays('Mondays, Sundays')].sort()).toEqual([0, 1]);
      expect([...parseClosingDays('martedi e domenica pomeriggio')].sort()).toEqual([0, 2]);
      expect(parseClosingDays('mai').size).toBe(0);
      expect(parseClosingDays('a marzo').size).toBe(0);
      expect(parseClosingDays(null).size).toBe(0);
    });
  });

  describe('parseOpeningHours', () => {
    it('trova le fasce orarie; null se non ce ne sono', () => {
      expect(parseOpeningHours('9:00-19:00')).toEqual([r('09:00', '19:00')]);
      expect(parseOpeningHours('09.00–13.00, 15.00–19.30')).toEqual([r('09:00', '13:00'), r('15:00', '19:30')]);
      expect(parseOpeningHours('10:00 - 24:00')).toEqual([r('10:00', '23:59')]);
      expect(parseOpeningHours('9-17')).toEqual([r('09:00', '17:00')]);
      expect(parseOpeningHours('lun-ven 9-13 e 15.30-19')).toEqual([r('09:00', '13:00'), r('15:30', '19:00')]);
      expect(parseOpeningHours('dal 12-05-2030')).toBeNull();
      expect(parseOpeningHours('sempre aperto')).toBeNull();
      expect(parseOpeningHours(undefined)).toBeNull();
    });
  });

  describe('carico e fasce libere', () => {
    it('dayLoad conta le tappe e i minuti occupati (sovrapposizioni una volta)', () => {
      expect(dayLoad([r('09:00', '11:00'), r('10:00', '12:00'), null])).toEqual({ count: 3, busyMinutes: 180 });
      expect(dayLoad([r('15:00')])).toEqual({ count: 1, busyMinutes: 60 });
    });

    it('freeSlots: spazi di almeno un\'ora tra 09:00 e 22:00, anche da "adesso"', () => {
      expect(freeSlots([r('09:00', '11:00'), r('12:30', '14:00'), r('15:00', '17:00')]))
        .toEqual([r('11:00', '12:30'), r('14:00', '15:00'), r('17:00', '22:00')]);
      expect(freeSlots([])).toEqual([r('09:00', '22:00')]);
      expect(freeSlots([r('09:00', '11:00')], 18 * 60)).toEqual([r('18:00', '22:00')]);
    });

    it('stopDuration: dagli orari o 90 minuti', () => {
      expect(stopDuration(r('10:00', '12:30'))).toBe(150);
      expect(stopDuration(r('10:00'))).toBe(90);
      expect(stopDuration(null)).toBe(90);
    });

    it('placeInSlots: prima fascia libera compatibile con gli orari di apertura', () => {
      const slots = [r('09:00', '11:00'), r('14:00', '22:00')];
      expect(placeInSlots(90, slots, null)).toEqual(r('09:00', '10:30'));
      expect(placeInSlots(90, slots, [r('10:00', '19:00')])).toEqual(r('14:00', '15:30'));
      expect(placeInSlots(180, [r('09:00', '11:00')], null)).toBeNull();
      expect(placeInSlots(90, slots, [r('20:00', '21:00')])).toBeNull();
    });
  });

  describe('giorno consigliato', () => {
    // 2030-07-01 è un lunedì.
    const days: CandidateDay[] = [
      { day: 2, date: '2030-07-01', stops: [] },
      { day: 3, date: '2030-07-02', stops: [r('09:00', '13:30'), r('15:00', '18:00')] },
      { day: 4, date: '2030-07-03', stops: [r('10:00', '11:00')] }
    ];

    it('weekdayOf', () => {
      expect(weekdayOf('2030-07-01')).toBe(1);
      expect(weekdayOf('2030-07-07')).toBe(0);
    });

    it('il giorno meno carico e aperto; chiuso il lunedì → consigliato il giorno 4', () => {
      const options = buildDayOptions({ times: r('10:00', '12:00'), closingDays: 'Lunedì', openingHours: '9:00-19:00', hasBooking: true }, days);
      const byDay = new Map(options.map(o => [o.day, o]));
      expect(byDay.get(2)!.closed).toBeTrue();
      expect(byDay.get(2)!.proposed).toBeNull();
      expect(byDay.get(3)!.proposed).toBeNull(); // nessuno spazio di 2 ore entro le 19:00
      expect(byDay.get(3)!.hoursConflict).toBeTrue(); // ci sarebbe la sera, ma è chiuso
      expect(byDay.get(4)!.proposed).toEqual(r('11:00', '13:00'));
      expect(byDay.get(4)!.recommended).toBeTrue();
      expect(options.filter(o => o.recommended).length).toBe(1);
      expect(options.every(o => o.bookingWarning)).toBeTrue();
    });

    it('senza vincoli consiglia il giorno libero; a parità il primo', () => {
      const options = buildDayOptions({ times: null, hasBooking: false }, days);
      expect(options.find(o => o.recommended)!.day).toBe(2);
      expect(options.find(o => o.day === 2)!.proposed).toEqual(r('09:00', '10:30'));
      expect(recommendDay([
        { day: 5, closed: false, proposed: r('09:00'), load: { count: 0, busyMinutes: 0 } },
        { day: 6, closed: false, proposed: r('09:00'), load: { count: 0, busyMinutes: 0 } }
      ])).toBe(5);
    });

    it('nessun giorno compatibile: nessun consiglio', () => {
      expect(recommendDay([{ day: 2, closed: true, proposed: null, load: { count: 0, busyMinutes: 0 } }])).toBeNull();
    });
  });
});

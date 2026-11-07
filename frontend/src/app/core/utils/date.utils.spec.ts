import { deriveTripStatus } from '../models/trip.model';
import { addDaysIso, isoYearsAgo, todayIso, toIsoDate } from './date.utils';

/** I test "ora italiana" hanno senso solo se il browser gira con il fuso di Roma (npm run test:unit lo imposta). */
const IN_ROME = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Rome';

describe('date.utils', () => {
  afterEach(() => jasmine.clock().uninstall());

  /** Simula "adesso" con jasmine.clock. */
  function setNow(date: Date): void {
    jasmine.clock().install();
    jasmine.clock().mockDate(date);
  }

  describe('alle 00:30 ora locale', () => {
    // new Date(anno, mese, giorno, ore, minuti) è sull'ora locale, qualunque sia il fuso.
    const halfPastMidnight = new Date(2026, 10, 7, 0, 30);

    it('todayIso() restituisce il giorno locale', () => {
      setNow(halfPastMidnight);
      expect(todayIso()).toBe('2026-11-07');
      expect(toIsoDate(new Date())).toBe('2026-11-07');
    });

    it('deriveTripStatus: un viaggio che inizia oggi è in corso, uno finito ieri è concluso', () => {
      setNow(halfPastMidnight);
      expect(deriveTripStatus({ startDate: '2026-11-07', endDate: '2026-11-10' })).toBe('ongoing');
      expect(deriveTripStatus({ startDate: '2026-11-01', endDate: '2026-11-06' })).toBe('completed');
      expect(deriveTripStatus({ startDate: '2026-11-08', endDate: '2026-11-10' })).toBe('upcoming');
    });
  });

  describe('alle 00:30 ora italiana (fuso Europe/Rome)', () => {
    beforeEach(() => {
      if (!IN_ROME) pending('richiede il fuso Europe/Rome: esegui `npm run test:unit`');
    });

    it('ora solare (CET, UTC+1): 23:30 UTC del giorno prima è già oggi', () => {
      setNow(new Date('2026-11-06T23:30:00Z')); // 07/11 00:30 in Italia
      expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-06'); // il vecchio calcolo in UTC, sbagliato
      expect(todayIso()).toBe('2026-11-07');
      expect(deriveTripStatus({ startDate: '2026-11-07', endDate: '2026-11-09' })).toBe('ongoing');
      expect(deriveTripStatus({ startDate: '2026-11-02', endDate: '2026-11-06' })).toBe('completed');
    });

    it('ora legale (CEST, UTC+2): 22:30 UTC del giorno prima è già oggi', () => {
      setNow(new Date('2026-07-19T22:30:00Z')); // 20/07 00:30 in Italia
      expect(todayIso()).toBe('2026-07-20');
      expect(isoYearsAgo(18)).toBe('2008-07-20');
    });
  });

  it('toIsoDate aggiunge gli zeri a mese e giorno', () => {
    expect(toIsoDate(new Date(2027, 0, 5, 12))).toBe('2027-01-05');
  });

  it('addDaysIso somma giorni a cavallo di mesi, anni e cambi d\'ora', () => {
    expect(addDaysIso('2027-06-10', 3)).toBe('2027-06-13');
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysIso('2027-03-27', 2)).toBe('2027-03-29'); // passaggio all'ora legale
    expect(addDaysIso('2027-10-30', 2)).toBe('2027-11-01'); // ritorno all'ora solare
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2027-06-10', 0)).toBe('2027-06-10');
    expect(addDaysIso('2027-06-01', -1)).toBe('2027-05-31');
  });

  it('isoYearsAgo usa la data locale', () => {
    setNow(new Date(2026, 10, 7, 0, 30));
    expect(isoYearsAgo(18)).toBe('2008-11-07');
  });
});

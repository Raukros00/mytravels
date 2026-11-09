import {
  RainStopInput,
  WeatherHour,
  hourAt,
  hourLabel,
  isOutdoorStop,
  isWetHour,
  rainAdvice,
  rainLabel,
  rainOutlook,
  weatherInfo
} from './weather.utils';

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function hour(h: number, wet: boolean, extra: Partial<WeatherHour> = {}): WeatherHour {
  return {
    time: `${String(h).padStart(2, '0')}:00`,
    temperature: 20 + (h % 5),
    precipitationProbability: wet ? 80 : 5,
    precipitation: wet ? 1.2 : 0,
    weatherCode: wet ? 61 : 1,
    ...extra
  };
}

/** Sereno fino alle 15, pioggia dalle 16 alle 19, poi di nuovo asciutto. */
const day = () => Array.from({ length: 24 }, (_, h) => hour(h, h >= 16 && h <= 19));

function stop(name: string, outdoor: boolean, start?: string, end?: string, extra: Partial<RainStopInput> = {}): RainStopInput {
  return { name, outdoor, times: start ? { start, end: end ?? null } : null, done: false, skipped: false, ...extra };
}

describe('weather.utils', () => {
  describe('weatherInfo', () => {
    it('icona e descrizione dei codici WMO', () => {
      expect(weatherInfo(0)).toEqual({ icon: '☀️', label: 'Sereno' });
      expect(weatherInfo(0, true).icon).toBe('🌙');
      expect(weatherInfo(3).label).toBe('Nuvoloso');
      expect(weatherInfo(63).label).toBe('Pioggia');
      expect(weatherInfo(81).label).toBe('Pioggia');
      expect(weatherInfo(53).label).toBe('Pioviggine');
      expect(weatherInfo(73).label).toBe('Neve');
      expect(weatherInfo(95).label).toBe('Temporale');
      expect(weatherInfo(null).label).toBe('Meteo');
    });
  });

  describe('isWetHour', () => {
    it('codice di pioggia oppure probabilità alta con precipitazioni', () => {
      expect(isWetHour(hour(10, true))).toBeTrue();
      expect(isWetHour(hour(10, false))).toBeFalse();
      expect(isWetHour(hour(10, false, { precipitationProbability: 70, precipitation: 0.4 }))).toBeTrue();
      expect(isWetHour(hour(10, false, { precipitationProbability: 70, precipitation: 0 }))).toBeFalse();
      expect(isWetHour(hour(10, false, { precipitationProbability: 70, precipitation: null }))).toBeTrue();
    });
  });

  describe('rainOutlook', () => {
    it('pioggia più tardi: dall\'ora della prima ora piovosa', () => {
      expect(rainOutlook(day(), at('10:30'))).toEqual({ kind: 'later', from: '16:00' });
    });

    it('pioggia in corso: fino alla prima ora asciutta', () => {
      expect(rainOutlook(day(), at('16:45'))).toEqual({ kind: 'now', until: '20:00' });
      const allWet = Array.from({ length: 24 }, (_, h) => hour(h, h >= 16));
      expect(rainOutlook(allWet, at('17:00'))).toEqual({ kind: 'now', until: null });
    });

    it('niente pioggia nel resto della giornata', () => {
      expect(rainOutlook(day(), at('20:10'))).toEqual({ kind: 'none' });
      expect(rainOutlook([], at('10:00'))).toEqual({ kind: 'none' });
    });
  });

  describe('hourAt', () => {
    it('l\'ora in corso', () => {
      expect(hourAt(day(), at('10:59'))?.time).toBe('10:00');
      expect(hourAt([hour(9, false)], at('10:00'))).toBeNull();
    });
  });

  describe('isOutdoorStop', () => {
    it('monumenti e natura sono all\'aperto; musei, shopping e ristoranti no', () => {
      expect(isOutdoorStop('activity', 'monument')).toBeTrue();
      expect(isOutdoorStop('activity', 'nature')).toBeTrue();
      expect(isOutdoorStop('activity', 'museum')).toBeFalse();
      expect(isOutdoorStop('activity', 'shopping')).toBeFalse();
      expect(isOutdoorStop('activity', undefined)).toBeFalse();
      expect(isOutdoorStop('food', 'lunch')).toBeFalse();
    });
  });

  describe('rainAdvice', () => {
    const stops = () => [
      stop('Duomo', true, '09:00', '11:00'),
      stop('Museo Egizio', false, '15:00', '17:00'),
      stop('Parco del Valentino', true, '17:00', '18:30'),
      stop('Passeggiata', true)
    ];

    it('pioggia più tardi: le tappe all\'aperto che finirebbero sotto la pioggia', () => {
      const advice = rainAdvice(stops(), { kind: 'later', from: '16:00' }, at('10:00'));
      expect(advice?.stops).toEqual(['Parco del Valentino', 'Passeggiata']);
      expect(advice?.text).toBe('Dalle 16 è prevista pioggia: meglio fare prima le tappe all\'aperto: Parco del Valentino, Passeggiata.');
    });

    it('esclude tappe fatte, saltate o già finite', () => {
      const list = [
        stop('Parco', true, '17:00', '18:00', { done: true }),
        stop('Giardini', true, undefined, undefined, { skipped: true }),
        stop('Ponte', true, '08:00', '09:00')
      ];
      expect(rainAdvice(list, { kind: 'later', from: '16:00' }, at('10:00'))).toBeNull();
    });

    it('una tappa senza fine dura un\'ora', () => {
      const advice = rainAdvice([stop('Mole', true, '15:30')], { kind: 'later', from: '16:00' }, at('10:00'));
      expect(advice?.stops).toEqual(['Mole']);
      expect(rainAdvice([stop('Mole', true, '14:00')], { kind: 'later', from: '16:00' }, at('10:00'))).toBeNull();
    });

    it('pioggia in corso: rimandare le tappe all\'aperto', () => {
      const advice = rainAdvice(stops(), { kind: 'now', until: '20:00' }, at('16:30'));
      expect(advice?.stops).toEqual(['Parco del Valentino', 'Passeggiata']);
      expect(advice?.text).toContain('Sta piovendo (fino alle 20 circa)');
    });

    it('niente pioggia o nessuna tappa all\'aperto: nessun suggerimento', () => {
      expect(rainAdvice(stops(), { kind: 'none' }, at('10:00'))).toBeNull();
      expect(rainAdvice([stop('Museo', false, '17:00', '18:00')], { kind: 'later', from: '16:00' }, at('10:00'))).toBeNull();
    });
  });

  describe('etichette', () => {
    it('ore e pioggia', () => {
      expect(hourLabel('16:00')).toBe('16');
      expect(hourLabel('09:00')).toBe('9');
      expect(hourLabel('16:30')).toBe('16:30');
      expect(rainLabel({ kind: 'later', from: '16:00' })).toBe('pioggia dalle 16:00');
      expect(rainLabel({ kind: 'now', until: '18:00' })).toBe('pioggia fino alle 18:00');
      expect(rainLabel({ kind: 'now', until: null })).toBe('pioggia in corso');
      expect(rainLabel({ kind: 'none' })).toBe('niente pioggia');
    });
  });
});

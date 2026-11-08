import {
  SuggestPlace,
  SuggestStop,
  SuggestionInput,
  closedWeekdays,
  collectSuggestions,
  computeSuggestions,
  mealWindowAt,
  rankPlaces
} from './live-suggestions.utils';
import { toMinutes } from './day-schedule.utils';

/** Barcellona, una giornata d'esempio (mercoledì = 3). */
const SAGRADA = { lat: 41.4036, lng: 2.1744 };
const BATLLO = { lat: 41.3916, lng: 2.1649 };
const HOTEL = { lat: 41.3870, lng: 2.1700 };

function stop(id: string, name: string, start: string | null, end: string | null, extra: Partial<SuggestStop> = {}): SuggestStop {
  return {
    id: `activity:${id}`, type: 'activity', name,
    times: start ? { start, end } : null, done: false, skipped: false, ...extra
  };
}

function food(id: string, name: string, meal: string, start: string | null = null, end: string | null = null, extra: Partial<SuggestStop> = {}): SuggestStop {
  return { ...stop(id, name, start, end, extra), id: `food:${id}`, type: 'food', meal, ...extra };
}

const place = (id: string, name: string, coordinates?: { lat: number; lng: number }, today = false): SuggestPlace =>
  ({ id, name, coordinates, today, meal: 'lunch' });

function input(now: string, stops: SuggestStop[], extra: Partial<SuggestionInput> = {}): SuggestionInput {
  return { nowMinutes: toMinutes(now), weekday: 3, stops, ...extra };
}

const kinds = (i: SuggestionInput) => collectSuggestions(i).map(s => s.kind);

describe('live-suggestions.utils', () => {
  describe('closedWeekdays e mealWindowAt', () => {
    it('giorni di chiusura dal loro campo e dagli orari ("9-17, chiuso il lunedì")', () => {
      expect([...closedWeekdays('chiuso il lunedì')]).toEqual([1]);
      expect([...closedWeekdays(null, '9-17, chiuso il lunedì')]).toEqual([1]);
      expect([...closedWeekdays(null, 'Mon-Fri 9-17, closed on Sundays')]).toEqual([0]);
      // Senza "chiuso" i giorni negli orari sono quelli di apertura, non di chiusura.
      expect(closedWeekdays(null, 'lun-ven 9-17').size).toBe(0);
      expect(closedWeekdays('sempre aperto').size).toBe(0);
    });

    it('fasce di pranzo e cena', () => {
      expect(mealWindowAt(toMinutes('11:59'))).toBeNull();
      expect(mealWindowAt(toMinutes('12:00'))).toBe('lunch');
      expect(mealWindowAt(toMinutes('14:29'))).toBe('lunch');
      expect(mealWindowAt(toMinutes('16:00'))).toBeNull();
      expect(mealWindowAt(toMinutes('20:00'))).toBe('dinner');
    });
  });

  describe('inizio di una tappa', () => {
    const day = [stop('s', 'Sagrada Família', '10:00', '12:00'), stop('b', 'Casa Batlló', '15:00', '17:00')];

    it('"Ora: Sagrada Família, poi Casa Batlló" con Indicazioni e Fatto', () => {
      const { primary } = computeSuggestions(input('10:05', day));
      expect(primary).toEqual(jasmine.objectContaining({
        kind: 'start', text: 'start', params: { name: 'Sagrada Família', next: 'Casa Batlló' },
        stopId: 'activity:s', actions: ['directions', 'done']
      }));
    });

    it('l\'ultima tappa senza "poi"; prima che inizi nessun suggerimento d\'inizio', () => {
      expect(computeSuggestions(input('15:30', day)).primary).toEqual(jasmine.objectContaining({ kind: 'start', text: 'start_last' }));
      expect(kinds(input('08:00', day))).not.toContain('start');
    });
  });

  describe('pasti', () => {
    // Orario indicativo del pranzo (12:30–14:00), come lo calcola la guida.
    const lunch = food('c', 'Bar Cañete', 'lunch', '12:30', '14:00');
    const day = [stop('s', 'Sagrada Família', '10:00', '12:00'), lunch, stop('b', 'Casa Batlló', '15:00', '17:00')];

    it('ristorante in programma: "È ora di pranzo: che ne dici di Bar Cañete?" con Andiamo · Scegli un altro · Saltiamo', () => {
      const places = [place('x', 'Cervecería', BATLLO), place('c', 'Bar Cañete', BATLLO, true)];
      const { primary } = computeSuggestions(input('12:10', day, { places }));
      expect(primary).toEqual(jasmine.objectContaining({
        kind: 'meal-planned', text: 'meal_planned', params: { name: 'Bar Cañete', meal: 'lunch' },
        stopId: 'food:c', actions: ['go', 'choose', 'skip']
      }));
      // Tra le alternative non c'è il locale in programma.
      expect(primary!.places!.map(p => p.name)).toEqual(['Cervecería']);
    });

    it('il locale si propone da mezz\'ora prima (orario indicativo 12:30) e non dopo la fine', () => {
      expect(computeSuggestions(input('12:00', day)).primary?.kind).toBe('meal-planned');
      expect(kinds(input('11:59', day))).not.toContain('meal-planned');
      expect(kinds(input('14:00', day))).not.toContain('meal-planned');
      // Senza alternative niente "Scegli un altro".
      expect(collectSuggestions(input('12:30', day)).find(s => s.kind === 'meal-planned')?.actions).toEqual(['go', 'skip']);
    });

    it('cena programmata con orario impostato', () => {
      const dinner = food('d', 'Can Solé', 'dinner', '20:30', '22:00');
      expect(computeSuggestions(input('20:15', [dinner])).primary).toEqual(jasmine.objectContaining({
        kind: 'meal-planned', params: { name: 'Can Solé', meal: 'dinner' }
      }));
    });

    it('senza ristorante: i locali salvati, dal più vicino alla tappa in corso', () => {
      const morning = [stop('s', 'Sagrada Família', '10:00', '13:00', { coordinates: SAGRADA })];
      const places = [
        place('far', 'Lontano', { lat: 41.38, lng: 2.19 }),
        place('none', 'Senza posizione'),
        place('near', 'Vicino', { lat: 41.404, lng: 2.175 })
      ];
      const { primary } = computeSuggestions(input('12:30', morning, { places }));
      expect(primary).toEqual(jasmine.objectContaining({
        kind: 'meal-none', text: 'meal_none_near', params: { meal: 'lunch', count: 3 }, actions: ['list', 'ignore']
      }));
      expect(primary!.places!.map(p => p.name)).toEqual(['Vicino', 'Lontano', 'Senza posizione']);
      expect(primary!.places![0].distance!).toBeLessThan(100);
      expect(primary!.places![2].distance).toBeNull();
    });

    it('senza coordinate i locali sono "salvati" (non "vicino a te"); senza locali un invito gentile', () => {
      const places = [place('b', 'Bodega'), place('a', 'Albergueria')];
      const res = computeSuggestions(input('20:00', [], { places })).primary!;
      expect(res.text).toBe('meal_none');
      expect(res.params['meal']).toBe('dinner');
      expect(res.places!.map(p => p.name)).toEqual(['Albergueria', 'Bodega']);
      expect(computeSuggestions(input('13:00', [])).primary).toEqual(jasmine.objectContaining({ text: 'meal_none_empty', actions: ['ignore'] }));
    });

    it('il punto di riferimento è l\'alloggio se nessuna tappa ha coordinate', () => {
      const places = [place('a', 'A', BATLLO), place('b', 'B', HOTEL)];
      const res = computeSuggestions(input('13:00', [], { places, accommodation: { name: 'Hotel', coordinates: HOTEL } })).primary!;
      expect(res.places!.map(p => p.name)).toEqual(['B', 'A']);
    });

    it('nessun invito se il pasto è già in programma, fatto o saltato, né fuori dalle fasce', () => {
      expect(kinds(input('13:00', [food('c', 'Bar', 'lunch', null, null, { done: true })]))).not.toContain('meal-none');
      expect(kinds(input('13:00', [food('c', 'Bar', 'lunch', null, null, { skipped: true })]))).not.toContain('meal-none');
      // Un locale senza pasto ma con orario nella fascia vale come pranzo.
      expect(kinds(input('13:00', [food('c', 'Bar', 'snack', '12:45', '13:30')]))).not.toContain('meal-none');
      expect(kinds(input('16:00', []))).not.toContain('meal-none');
    });
  });

  describe('prenotazioni e biglietti', () => {
    it('"Il ristorante X richiede la prenotazione: l\'hai fatta?" con Sì (e Apri link se c\'è)', () => {
      const day = [food('c', 'Bar Cañete', 'dinner', '20:30', null, { bookingRequired: true })];
      const s = collectSuggestions(input('10:00', day)).find(x => x.kind === 'booking')!;
      expect(s).toEqual(jasmine.objectContaining({ text: 'booking_food', params: { name: 'Bar Cañete' }, actions: ['booked'] }));

      const act = [stop('p', 'Museo Picasso', '16:00', '18:00', { bookingRequired: true, bookingUrl: 'https://museupicasso.example' })];
      expect(collectSuggestions(input('10:00', act)).find(x => x.kind === 'booking')).toEqual(jasmine.objectContaining({
        text: 'booking', actions: ['booked', 'link'], url: 'https://museupicasso.example'
      }));
    });

    it('"Per la Sagrada Família servono i biglietti (26 €)" con Apri link', () => {
      const day = [stop('s', 'Sagrada Família', '10:00', '12:00', {
        ticketsRequired: true, bookingRequired: true, ticketPrice: 26, currency: 'EUR', bookingUrl: 'https://sagradafamilia.example'
      })];
      const list = collectSuggestions(input('09:00', day));
      expect(list.find(x => x.kind === 'tickets')).toEqual(jasmine.objectContaining({
        text: 'tickets_price', params: { name: 'Sagrada Família', price: 26, currency: 'EUR' },
        actions: ['link', 'ignore'], url: 'https://sagradafamilia.example'
      }));
      // Con i biglietti non si chiede anche della prenotazione.
      expect(list.some(x => x.kind === 'booking')).toBeFalse();
      expect(collectSuggestions(input('09:00', [stop('s', 'S', '10:00', null, { ticketsRequired: true })]))
        .find(x => x.kind === 'tickets')!.text).toBe('tickets');
    });

    it('niente promemoria per le tappe fatte, saltate o passate; "Sì" li chiude', () => {
      const s = (extra: Partial<SuggestStop>) => [stop('s', 'S', '10:00', '11:00', { ticketsRequired: true, ...extra })];
      expect(kinds(input('09:00', s({ done: true })))).not.toContain('tickets');
      expect(kinds(input('09:00', s({ skipped: true })))).not.toContain('tickets');
      expect(kinds(input('12:00', s({})))).not.toContain('tickets');
      const day = [food('c', 'Bar', 'dinner', '20:30', null, { bookingRequired: true })];
      expect(computeSuggestions(input('10:00', day, { dismissed: new Set(['booking:food:c']) })).primary).toBeNull();
    });
  });

  describe('chiusure', () => {
    it('"Oggi il Museo X è chiuso (lunedì)" con Sposta a un altro giorno: principale se è la tappa attuale', () => {
      const day = [stop('m', 'Museo X', '10:00', '12:00', { closingDays: 'Lunedì' }), stop('b', 'Casa Batlló', '15:00', '17:00')];
      const { primary } = computeSuggestions(input('09:30', day, { weekday: 1 }));
      expect(primary).toEqual(jasmine.objectContaining({
        kind: 'closed-today', text: 'closed_today', params: { name: 'Museo X', weekday: 1 },
        stopId: 'activity:m', actions: ['move', 'skip']
      }));
      expect(kinds(input('09:30', day, { weekday: 2 }))).not.toContain('closed-today');
    });

    it('chiusura imminente durante la visita: "Il Museo Picasso chiude alle 17:00"', () => {
      const day = [stop('p', 'Museo Picasso', '15:00', '16:45', { openingHours: '9:00 - 17:00' })];
      expect(kinds(input('15:30', day))).not.toContain('closing-soon');
      const s = collectSuggestions(input('16:10', day)).find(x => x.kind === 'closing-soon')!;
      expect(s).toEqual(jasmine.objectContaining({ text: 'closing_soon', params: { name: 'Museo Picasso', time: '17:00', minutes: 50 } }));
    });

    it('la visita in programma finisce dopo la chiusura ("9-17")', () => {
      const day = [stop('p', 'Museo Picasso', '16:00', '18:00', { openingHours: '9-17' })];
      expect(collectSuggestions(input('10:00', day)).find(x => x.kind === 'closing-soon')).toEqual(jasmine.objectContaining({
        text: 'closes_before_end', params: { name: 'Museo Picasso', time: '17:00' }, actions: ['move', 'ignore']
      }));
    });

    it('chiuso all\'orario previsto: avviso con gli orari', () => {
      const day = [stop('p', 'Museo', '18:00', '19:00', { openingHours: '09:00-13:00, 15:00-17:00' })];
      expect(collectSuggestions(input('10:00', day)).find(x => x.kind === 'closed-hours')).toEqual(jasmine.objectContaining({
        text: 'closed_hours', params: { name: 'Museo', hours: '09:00–13:00, 15:00–17:00' }
      }));
    });

    it('orari non interpretabili: nessun avviso', () => {
      const day = [stop('p', 'Museo', '18:00', '19:00', { openingHours: 'sempre aperto', closingDays: 'mai' })];
      expect(kinds(input('18:30', day))).toEqual(['start']);
    });
  });

  describe('ritardo sul programma', () => {
    const day = [
      stop('s', 'Sagrada Família', '10:00', '12:00'),
      stop('g', 'Park Güell', '12:30', '14:00'),
      stop('b', 'Casa Batlló', '16:00', '18:00')
    ];

    it('"Sei in ritardo di 40 min: vuoi spostare Casa Batlló?" con Sposta · Ignora (flusso #112)', () => {
      const { primary } = computeSuggestions(input('12:40', day));
      expect(primary).toEqual(jasmine.objectContaining({
        kind: 'late', text: 'late', params: { minutes: 40, name: 'Casa Batlló', previous: 'Sagrada Família' },
        stopId: 'activity:b', actions: ['move', 'ignore']
      }));
    });

    it('niente ritardo se la tappa precedente è fatta o saltata, se il ritardo è poco o troppo', () => {
      expect(kinds(input('12:40', [{ ...day[0], done: true }, day[1], day[2]]))).not.toContain('late');
      expect(kinds(input('12:40', [{ ...day[0], skipped: true }, day[1], day[2]]))).not.toContain('late');
      expect(kinds(input('12:20', day))).not.toContain('late');
      expect(kinds(input('16:30', [day[0], day[2]]))).not.toContain('late');
    });

    it('Ignora lo chiude', () => {
      const res = computeSuggestions(input('12:40', day, { dismissed: new Set(['late:activity:s']) }));
      expect([res.primary, ...res.secondary].map(s => s!.kind)).toEqual(['meal-none', 'start']);
    });
  });

  describe('fine giornata', () => {
    it('"Giornata finita! Torna all\'hotel" con Indicazioni; senza alloggio solo il saluto', () => {
      const day = [stop('s', 'Sagrada Família', '10:00', '12:00', { done: true })];
      expect(computeSuggestions(input('21:45', day, { accommodation: { name: 'Hotel Arts' } })).primary).toEqual(jasmine.objectContaining({
        kind: 'day-end', text: 'day_end_home', params: { name: 'Hotel Arts' }, actions: ['directions'], tone: 'success'
      }));
      expect(computeSuggestions(input('21:45', day)).primary).toEqual(jasmine.objectContaining({ text: 'day_end', actions: [] }));
    });

    it('giornata vuota: niente "giornata finita"', () => {
      expect(kinds(input('22:00', []))).not.toContain('day-end');
    });
  });

  describe('priorità', () => {
    it('chiusura di oggi > ritardo > pasto > inizio > promemoria; al massimo 3 secondari', () => {
      const day = [
        stop('s', 'Sagrada Família', '10:00', '11:30'),
        stop('m', 'Museo X', '12:00', '14:00', { closingDays: 'mercoledì', ticketsRequired: true }),
        food('c', 'Bar Cañete', 'lunch', '14:00', '15:00', { bookingRequired: true }),
        stop('b', 'Casa Batlló', '16:00', '18:00', { ticketsRequired: true }),
        stop('p', 'Palau', '18:00', '19:00', { bookingRequired: true })
      ];
      const res = computeSuggestions(input('12:05', day));
      expect(res.primary?.kind).toBe('closed-today');
      expect(res.secondary.length).toBe(3);
      expect(res.secondary[0].kind).toBe('late');
    });
  });

  describe('rankPlaces', () => {
    it('senza punto di partenza solo per nome', () => {
      expect(rankPlaces([place('b', 'B', BATLLO), place('a', 'A', SAGRADA)], null).map(p => [p.name, p.distance])).toEqual([['A', null], ['B', null]]);
    });
  });
});

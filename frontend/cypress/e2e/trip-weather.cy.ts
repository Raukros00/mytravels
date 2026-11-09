import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #111 Meteo della giornata nella guida "In viaggio" (/trips/:id/live).
 * Open-Meteo è finto (e2e/api-stubs.py): sereno fino alle 15 e pioggia dalle 16:00 (24° di massima);
 * con latitudine >= 50 sereno tutto il giorno; /__fail?service=open-meteo lo mette fuori uso.
 * L'ora è simulata con cy.clock (solo `Date`). La logica (pioggia, tappe all'aperto) ha anche i test unitari
 * in src/app/core/utils/weather.utils.spec.ts.
 */

const STUB = 'http://127.0.0.1:18090';
const DAY1 = '2030-08-05';
const DAY2 = '2030-08-06';

interface WeatherTrip { id: string; title: string }

function activity(name: string, category: string, extra: Record<string, unknown> = {}) {
  return { name, category, address: 'Torino', ticketsRequired: false, bookingRequired: false, assignedDay: 1, ...extra };
}

/** Viaggio a Torino (coordinate della destinazione) con tappe al coperto e all'aperto il primo giorno. */
function createRainyTrip(): Cypress.Chainable<WeatherTrip> {
  const title = uniq('E2E Meteo');
  return cy.createTrip('admin', GROUPS.esploratori, {
    title, destination: 'Torino', startDate: DAY1, endDate: DAY2, destinationLat: 45.0703, destinationLng: 7.6869
  }).then(trip => {
    const base = `/api/v1/trips/${trip.id}`;
    cy.api('admin', 'POST', `${base}/activities`, activity('Duomo', 'monument', { startTime: '09:00', endTime: '11:00' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Museo Egizio', 'museum', { startTime: '15:00', endTime: '17:00' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Parco del Valentino', 'nature', { startTime: '17:00', endTime: '18:30' }));
    return cy.wrap({ id: trip.id as string, title });
  });
}

/** Apre la guida con l'ora locale indicata (`yyyy-MM-ddTHH:mm`). */
function openAt(trip: WeatherTrip, localDateTime: string) {
  const [date, time] = localDateTime.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
  cy.visit(`/trips/${trip.id}/live`);
  cy.contains('.live-trip-title', trip.title).should('be.visible');
}

describe('In viaggio – meteo della giornata', () => {
  let rainy: WeatherTrip;

  before(() => {
    cy.request(`${STUB}/__fail`);
    createRainyTrip().then(t => (rainy = t));
  });

  beforeEach(() => cy.login('admin'));

  it('intestazione con icona, temperatura e pioggia; suggerimento per le tappe all\'aperto', () => {
    openAt(rainy, `${DAY1}T10:30`);
    cy.get('[data-cy="live-weather"]').should('be.visible').within(() => {
      cy.get('.live-weather-icon').should('have.text', '🌤️');
      cy.get('.live-weather-temp').invoke('text').should('match', /^\d+°$/);
      cy.get('.live-weather-rain').should('contain.text', 'pioggia dalle 16:00');
      cy.get('.live-weather-range').should('have.text', 'max 24° · min 15°');
      cy.contains('a', 'Open-Meteo').should('have.attr', 'href', 'https://open-meteo.com/');
    });
    cy.get('[data-cy="live-rain-advice"]')
      .should('contain.text', 'Dalle 16 è prevista pioggia: meglio fare prima le tappe all\'aperto')
      .and('contain.text', 'Parco del Valentino')
      .and('not.contain.text', 'Museo Egizio')
      .and('not.contain.text', 'Duomo');

    // Il backend ha chiesto a Open-Meteo le previsioni del giorno per le coordinate della destinazione.
    cy.request(`${STUB}/__state`).its('body.weather').then((calls: Record<string, string>[]) => {
      const call = calls.find(c => c['start_date'] === DAY1 && c['latitude'].startsWith('45.07'));
      expect(call, 'richiesta a Open-Meteo').to.exist;
      expect(call!['end_date']).to.eq(DAY1);
      expect(call!['longitude']).to.match(/^7\.68/);
      expect(call!['hourly']).to.contain('precipitation_probability');
      expect(call!['timezone']).to.eq('auto');
    });
  });

  it('durante la pioggia: pioggia in corso e consiglio di rimandare le tappe all\'aperto', () => {
    openAt(rainy, `${DAY1}T16:30`);
    cy.get('.live-weather-icon').should('have.text', '🌧️');
    cy.get('.live-weather-rain').should('contain.text', 'pioggia in corso');
    cy.get('[data-cy="live-rain-advice"]').should('contain.text', 'Sta piovendo').and('contain.text', 'Parco del Valentino');
  });

  it('tappa all\'aperto già fatta: nessun suggerimento', () => {
    cy.api('admin', 'GET', `/api/v1/trips/${rainy.id}`).then(trip => {
      const parco = trip.activities.find((a: { name: string }) => a.name === 'Parco del Valentino');
      cy.api('admin', 'PUT', `/api/v1/trips/${rainy.id}/activities/${parco.id}`, { ...parco, isCompleted: true });
    });
    openAt(rainy, `${DAY1}T10:30`);
    cy.get('[data-cy="live-weather"]').should('contain.text', 'pioggia dalle 16:00');
    cy.get('[data-cy="live-rain-advice"]').should('not.exist');
  });

  it('giornata asciutta (coordinate dalla tappa, destinazione a testo libero): niente pioggia né suggerimenti', () => {
    const title = uniq('E2E Meteo asciutto');
    cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Amsterdam', startDate: DAY1, endDate: DAY2 }).then(trip => {
      cy.api('admin', 'POST', `/api/v1/trips/${trip.id}/activities`,
        activity('Vondelpark', 'nature', { startTime: '17:00', endTime: '18:00', coordinates: { lat: 52.358, lng: 4.8686 } }));
      openAt({ id: trip.id, title }, `${DAY1}T10:30`);
    });
    cy.get('[data-cy="live-weather"]').should('contain.text', 'niente pioggia');
    cy.get('[data-cy="live-rain-advice"]').should('not.exist');
  });

  it('Open-Meteo non risponde: la guida funziona senza meteo', () => {
    const title = uniq('E2E Meteo giù');
    cy.request(`${STUB}/__fail?service=open-meteo`);
    // Coordinate diverse dagli altri test: niente risposta già in cache nel backend.
    cy.createTrip('admin', GROUPS.esploratori, {
      title, destination: 'Genova', startDate: DAY1, endDate: DAY2, destinationLat: 44.4056, destinationLng: 8.9463
    }).then(trip => {
      cy.api('admin', 'POST', `/api/v1/trips/${trip.id}/activities`, activity('Acquario', 'experience', { startTime: '10:00', endTime: '12:00' }));
      cy.intercept('GET', `/api/v1/trips/${trip.id}/weather*`).as('weather');
      openAt({ id: trip.id, title }, `${DAY1}T10:30`);
    });
    cy.wait('@weather').its('response.body.available').should('eq', false);
    cy.get('[data-cy="live-now"]').should('contain.text', 'Acquario');
    cy.get('[data-cy="live-weather"]').should('not.exist');
    cy.request(`${STUB}/__fail`);
  });

  it('solo i membri del gruppo e solo nelle date del viaggio', () => {
    const get = (user: 'admin' | 'luca', date: string) => cy.apiToken(user).then(token => cy.request({
      url: `/api/v1/trips/${rainy.id}/weather?date=${date}`, failOnStatusCode: false,
      headers: { Authorization: `Bearer ${token}` }
    }));
    get('luca', DAY1).its('status').should('eq', 404);
    get('admin', '2030-09-01').its('status').should('eq', 400);
    get('admin', DAY2).then(res => {
      expect(res.status).to.eq(200);
      expect(res.body.available).to.eq(true);
      expect(res.body.hourly).to.have.length(24);
      expect(res.body.hourly[16]).to.include({ time: '16:00', weatherCode: 61 });
    });
  });

  after(() => cy.request(`${STUB}/__fail`));
});

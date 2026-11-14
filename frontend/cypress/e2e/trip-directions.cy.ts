import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #106 Indicazioni per la prossima tappa: link alle app di mappe con i mezzi pubblici (Apple Maps su iPhone,
 * Google Maps su Android e desktop, Citymapper a scelta), partenza dalla tappa precedente / alloggio o dalla
 * posizione attuale se già concessa, stima "km · min a piedi" tra le tappe. Ora simulata con cy.clock.
 * URL e stime hanno i test unitari in src/app/core/utils/directions.utils.spec.ts.
 *
 * Viaggio a Firenze, da lunedì 4 a mercoledì 6 novembre 2030, giorno 1:
 *  Duomo 09:00–10:30, Uffizi 11:00–13:00, Ponte Vecchio 15:00–16:00 (tutti con coordinate),
 *  Mercato Centrale 17:00–18:00 (solo indirizzo). Alloggio con coordinate.
 */

interface DirTrip { id: string; title: string }

const DAY1 = '2030-11-04';
const HOTEL = { lat: 43.776, lng: 11.248 };
const DUOMO = { lat: 43.7731, lng: 11.256 };
const UFFIZI = { lat: 43.7678, lng: 11.2553 };
const PONTE = { lat: 43.768, lng: 11.2531 };

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
};

function activity(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'monument', address: 'Firenze', ticketsRequired: false, bookingRequired: false, assignedDay: 1, ...extra };
}

function createDirTrip(): Cypress.Chainable<DirTrip> {
  const title = uniq('E2E Indicazioni');
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Firenze', startDate: DAY1, endDate: '2030-11-06' }).then(trip => {
    const base = `/api/v1/trips/${trip.id}`;
    cy.api('admin', 'POST', `${base}/activities`, activity('Duomo', { startTime: '09:00', endTime: '10:30', address: 'Piazza del Duomo', coordinates: DUOMO }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Uffizi', { startTime: '11:00', endTime: '13:00', address: 'Piazzale degli Uffizi 6', coordinates: UFFIZI }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Ponte Vecchio', { startTime: '15:00', endTime: '16:00', coordinates: PONTE }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Mercato Centrale', { startTime: '17:00', endTime: '18:00', address: 'Via dell Ariento 10' }));
    cy.api('admin', 'PUT', `${base}/accommodation`, { name: 'Hotel Firenze', address: 'Via Nazionale 10', coordinates: HOTEL });
    return cy.wrap({ id: trip.id as string, title });
  });
}

interface OpenOptions {
  device?: keyof typeof UA;
  /** Geolocalizzazione già concessa al sito (non viene mai chiesta). */
  locationGranted?: boolean;
}

function openAt(trip: DirTrip, time: string, opts: OpenOptions = {}) {
  const [y, m, d] = DAY1.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
  cy.visit(`/trips/${trip.id}/live`, {
    onBeforeLoad(win) {
      if (opts.device) Object.defineProperty(win.navigator, 'userAgent', { get: () => UA[opts.device!] });
      if (win.navigator.permissions) {
        cy.stub(win.navigator.permissions, 'query').resolves({ state: opts.locationGranted ? 'granted' : 'prompt', onchange: null });
      }
      cy.stub(win.navigator.geolocation, 'getCurrentPosition').as('getPosition');
      cy.stub(win.navigator.geolocation, 'watchPosition').as('watchPosition');
    }
  });
  cy.contains('.live-trip-title', trip.title).should('be.visible');
}

const coord = (p: { lat: number; lng: number }) => `${p.lat},${p.lng}`;
const nowDirections = () => cy.get('[data-cy="live-now"] [data-cy="live-directions"]');
const dayItem = (name: string) => cy.contains('.live-timeline-item', name);

/** Stessa formula dell'app: linea d'aria (haversine), percorso × 1,3 a 4,8 km/h. */
function expectedWalk(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  const meters = 2 * 6_371_000 * Math.asin(Math.sqrt(h));
  const minutes = Math.max(1, Math.round((meters * 1.3) / 80));
  const dist = meters < 1000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  return `${dist} · ~${minutes} min a piedi`;
}

describe('In viaggio – indicazioni per la prossima tappa', () => {
  let trip: DirTrip;

  before(() => {
    createDirTrip().then(t => (trip = t));
  });

  beforeEach(() => cy.login('admin'));

  it('desktop: Google Maps con i mezzi pubblici, partenza dalla tappa precedente; stima a piedi tra le tappe', () => {
    openAt(trip, '11:30');
    nowDirections().should('have.attr', 'href',
      `https://www.google.com/maps/dir/?api=1&origin=${coord(DUOMO)}&destination=${coord(UFFIZI)}&travelmode=transit`);
    cy.get('[data-cy="live-now"] [data-cy="live-walk"]').should('contain.text', `${expectedWalk(DUOMO, UFFIZI)} dalla tappa precedente`);

    // Giornata: stima tra una tappa e la successiva solo se entrambe hanno coordinate.
    dayItem('Uffizi').find('[data-cy="live-timeline-walk"]').should('contain.text', expectedWalk(DUOMO, UFFIZI));
    dayItem('Ponte Vecchio').find('[data-cy="live-timeline-walk"]').should('contain.text', expectedWalk(UFFIZI, PONTE));
    dayItem('Mercato Centrale').find('[data-cy="live-timeline-walk"]').should('not.exist');

    // Indicazioni su ogni tappa: senza coordinate si usa nome e indirizzo.
    dayItem('Mercato Centrale').find('[data-cy="live-stop-directions"]').should('have.attr', 'href',
      `https://www.google.com/maps/dir/?api=1&origin=${coord(PONTE)}`
      + '&destination=Mercato%20Centrale,%20Via%20dell%20Ariento%2010&travelmode=transit');

    // Su desktop: Google Maps (predefinita) o Citymapper.
    cy.get('[data-cy="live-maps"] .live-maps-app').then($b =>
      expect([...$b].map(b => b.textContent!.trim())).to.deep.equal(['Google Maps', 'Citymapper']));
    cy.get('[data-cy="live-maps"] [data-app="google"]').should('have.attr', 'aria-pressed', 'true');
  });

  it('prima tappa della giornata: si parte dall\'alloggio', () => {
    openAt(trip, '08:30');
    nowDirections().should('have.attr', 'href',
      `https://www.google.com/maps/dir/?api=1&origin=${coord(HOTEL)}&destination=${coord(DUOMO)}&travelmode=transit`);
    cy.get('[data-cy="live-now"] [data-cy="live-walk"]').should('contain.text', `${expectedWalk(HOTEL, DUOMO)} dall'alloggio`);
  });

  it('iPhone: Apple Maps con dirflg=r, alternativa Google Maps e Citymapper; la scelta resta sul dispositivo', () => {
    openAt(trip, '11:30', { device: 'iphone' });
    nowDirections().should('have.attr', 'href', `https://maps.apple.com/?saddr=${coord(DUOMO)}&daddr=${coord(UFFIZI)}&dirflg=r`);
    cy.get('[data-cy="live-maps"] .live-maps-app').then($b =>
      expect([...$b].map(b => b.textContent!.trim())).to.deep.equal(['Apple Maps', 'Google Maps', 'Citymapper']));

    cy.get('[data-cy="live-maps"] [data-app="google"]').click().should('have.attr', 'aria-pressed', 'true');
    nowDirections().should('have.attr', 'href').and('match', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&.*travelmode=transit$/);
    cy.window().its('localStorage').invoke('getItem', 'wb_maps_app').should('eq', 'google');

    // Ricaricando la scelta resta.
    openAt(trip, '11:30', { device: 'iphone' });
    nowDirections().should('have.attr', 'href').and('contain', 'google.com/maps/dir');

    cy.get('[data-cy="live-maps"] [data-app="citymapper"]').click();
    nowDirections().should('have.attr', 'href',
      `https://citymapper.com/directions?startcoord=${coord(DUOMO)}&startname=Duomo&endcoord=${coord(UFFIZI)}&endname=Uffizi`);
  });

  it('Android: Google Maps con travelmode=transit; Apple Maps non è proposta', () => {
    openAt(trip, '11:30', { device: 'android' });
    nowDirections().should('have.attr', 'href',
      `https://www.google.com/maps/dir/?api=1&origin=${coord(DUOMO)}&destination=${coord(UFFIZI)}&travelmode=transit`);
    cy.get('[data-cy="live-maps"] [data-app="apple"]').should('not.exist');
  });

  it('posizione già concessa: si parte da dove si è (nessuna partenza nel link) e non viene mai chiesta', () => {
    openAt(trip, '11:30', { locationGranted: true });
    nowDirections().should('have.attr', 'href', `https://www.google.com/maps/dir/?api=1&destination=${coord(UFFIZI)}&travelmode=transit`);
    openAt(trip, '11:30', { device: 'iphone', locationGranted: true });
    nowDirections().should('have.attr', 'href', `https://maps.apple.com/?daddr=${coord(UFFIZI)}&dirflg=r`);
    cy.get('@getPosition').should('not.have.been.called');
    cy.get('@watchPosition').should('not.have.been.called');
  });

  it('fine giornata: indicazioni per l\'alloggio dall\'ultima tappa', () => {
    openAt(trip, '21:00');
    cy.get('[data-cy="live-home-directions"]').should('have.attr', 'href',
      'https://www.google.com/maps/dir/?api=1&origin=Mercato%20Centrale,%20Via%20dell%20Ariento%2010'
      + `&destination=${coord(HOTEL)}&travelmode=transit`);
  });
});

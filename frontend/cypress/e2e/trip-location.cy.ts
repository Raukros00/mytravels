import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #108 Posizione del telefono nella guida: permesso chiesto solo dopo un tocco, distanza reale dalla prossima tappa,
 * "Sei arrivato a X?" entro ~100 m, nessun invio della posizione al backend, permesso negato = guida come prima.
 * `navigator.geolocation` è simulato (watchPosition finto, posizioni spinte dal test); ora simulata con cy.clock.
 * Distanze e arrivo hanno i test unitari in src/app/core/utils/location.utils.spec.ts.
 *
 * Torino, giorno 1 (2 dicembre 2030): Mole 10:00–12:00 e Duomo 15:00–16:00, entrambi con coordinate.
 */

const DAY1 = '2030-12-02';
const MOLE = { lat: 45.06904, lng: 7.6933 };
const DUOMO = { lat: 45.07315, lng: 7.68524 };
/** Punto riconoscibile (Porta Nuova, ~1,4 km dalla Mole): non deve mai comparire nelle richieste al backend. */
const FAR = { lat: 45.062187, lng: 7.678712 };
/** ~40 m dalla Mole. */
const AT_MOLE = { lat: 45.06940, lng: 7.6933 };

interface LocTrip { id: string; title: string }

interface FakeGeo {
  /** Il browser chiede il permesso (watchPosition chiamato). */
  asked: number;
  push(p: { lat: number; lng: number }, accuracy?: number): void;
  deny(): void;
  cleared: number;
}

function createTrip(): Cypress.Chainable<LocTrip> {
  const title = uniq('E2E Posizione');
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Torino', startDate: DAY1, endDate: '2030-12-03' })
    .then(trip => {
      const base = `/api/v1/trips/${trip.id}`;
      const activity = (name: string, extra: Record<string, unknown>) => cy.api('admin', 'POST', `${base}/activities`, {
        name, category: 'monument', address: 'Torino', ticketsRequired: false, bookingRequired: false, assignedDay: 1, ...extra,
      });
      activity('Mole', { startTime: '10:00', endTime: '12:00', coordinates: MOLE });
      activity('Duomo', { startTime: '15:00', endTime: '16:00', coordinates: DUOMO });
      return cy.wrap({ id: trip.id as string, title });
    });
}

/** Richieste al backend durante il test (per verificare che la posizione non ci arrivi mai). */
let backendRequests: string[] = [];

function openAt(trip: LocTrip, time: string) {
  const [y, m, d] = DAY1.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  backendRequests = [];
  cy.intercept({ url: /\/(api|auth)\// }, req => {
    backendRequests.push(`${req.method} ${req.url} ${JSON.stringify(req.body ?? '')}`);
  });
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
  cy.visit(`/trips/${trip.id}/live`, {
    onBeforeLoad(win) {
      let success: ((p: GeolocationPosition) => void) | null = null;
      let failure: ((e: GeolocationPositionError) => void) | null = null;
      const fake: FakeGeo = {
        asked: 0,
        cleared: 0,
        push(p, accuracy = 15) {
          success?.({ coords: { latitude: p.lat, longitude: p.lng, accuracy }, timestamp: Date.now() } as GeolocationPosition);
        },
        deny() {
          failure?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
        },
      };
      const geo = {
        watchPosition(ok: PositionCallback, ko?: PositionErrorCallback | null) {
          fake.asked++;
          success = ok;
          failure = ko ?? null;
          return 1;
        },
        clearWatch() {
          fake.cleared++;
          success = null;
        },
        getCurrentPosition() {
          fake.asked++;
        },
      };
      Object.defineProperty(win.navigator, 'geolocation', { configurable: true, get: () => geo });
      if (win.navigator.permissions) {
        cy.stub(win.navigator.permissions, 'query').resolves({ state: 'prompt', onchange: null });
      }
      (win as unknown as { fakeGeo: FakeGeo }).fakeGeo = fake;
    },
  });
  cy.contains('.live-trip-title', trip.title).should('be.visible');
}

const fakeGeo = () => cy.window().its('fakeGeo') as unknown as Cypress.Chainable<FakeGeo>;
const location = () => cy.get('[data-cy="live-location"]');
const nowCard = () => cy.get('[data-cy="live-now"]');

describe('In viaggio – posizione del telefono', () => {
  let trip: LocTrip;

  before(() => {
    createTrip().then(t => (trip = t));
  });

  beforeEach(() => cy.login('admin'));

  it('il permesso si chiede solo dopo il tocco; distanza reale e indicazioni dalla posizione', () => {
    openAt(trip, '09:30');
    location().should('contain.text', 'La posizione resta sul telefono');
    nowCard().find('.live-now-name').should('have.text', 'Mole');
    // Aprendo la guida non si chiede niente.
    fakeGeo().its('asked').should('eq', 0);

    location().contains('button', 'Usa la mia posizione per le indicazioni').click();
    fakeGeo().its('asked').should('eq', 1);
    location().should('contain.text', 'Sto cercando la tua posizione');

    fakeGeo().then(g => g.push(FAR));
    location().should('have.attr', 'data-status', 'on').and('contain.text', 'Posizione attiva');
    nowCard().find('[data-cy="live-walk"]').should('contain.text', 'dalla tua posizione').and('contain.text', 'km');
    nowCard().find('[data-cy="live-directions"]').should('have.attr', 'href').and('contain', `${FAR.lat},${FAR.lng}`);
    cy.get('[data-cy="live-arrival"]').should('not.exist');

    // La distanza segue gli spostamenti.
    fakeGeo().then(g => g.push({ lat: 45.0675, lng: 7.6933 }));
    nowCard().find('[data-cy="live-walk"]').should('contain.text', ' m ·');

    // Nessuna richiesta al backend contiene la posizione.
    cy.wait(500).then(() => {
      const leaks = backendRequests.filter(r => r.includes(String(FAR.lat)) || r.includes(String(FAR.lng)) || r.includes('45.0675'));
      expect(leaks, 'richieste con la posizione').to.deep.equal([]);
    });
  });

  it('entro 100 m: "Sei arrivato?" e Segna come visitata; "No" la nasconde', () => {
    openAt(trip, '10:15');
    location().contains('button', 'Usa la mia posizione').click();
    fakeGeo().then(g => g.push(AT_MOLE));
    cy.get('[data-cy="live-arrival"]').should('contain.text', 'Sei arrivato a Mole?');

    // Posizione imprecisa: nessuna proposta.
    fakeGeo().then(g => g.push(AT_MOLE, 800));
    cy.get('[data-cy="live-arrival"]').should('not.exist');
    fakeGeo().then(g => g.push(AT_MOLE));

    // "No": non viene riproposta per questa tappa.
    cy.get('[data-cy="live-arrival"]').contains('button', 'No').click();
    cy.get('[data-cy="live-arrival"]').should('not.exist');
    fakeGeo().then(g => g.push(AT_MOLE));
    cy.get('[data-cy="live-arrival"]').should('not.exist');

    // Riaprendo la pagina la proposta torna; "Segna come visitata" la segna fatta.
    openAt(trip, '10:15');
    // Scelta ricordata ma permesso non concesso (stub "prompt"): si riparte solo con un nuovo tocco.
    fakeGeo().its('asked').should('eq', 0);
    location().contains('button', 'Usa la mia posizione').click();
    fakeGeo().then(g => g.push(AT_MOLE));
    cy.get('[data-cy="live-arrival"]').contains('button', 'Segna come visitata').click();
    cy.contains('.live-timeline-item', 'Mole').should('have.attr', 'data-status', 'done');
    cy.apiUntil<any>('admin', `/api/v1/trips/${trip.id}`, t =>
      expect(t.activities.find((a: { name: string }) => a.name === 'Mole').isCompleted).to.eq(true));
    cy.get('[data-cy="live-arrival"]').should('not.exist');
  });

  it('permesso negato: messaggio e guida come prima', () => {
    openAt(trip, '14:00');
    location().contains('button', 'Usa la mia posizione').click();
    fakeGeo().then(g => g.deny());
    cy.get('[data-cy="live-location-denied"]').should('contain.text', 'la guida funziona come prima');
    nowCard().find('.live-now-name').should('have.text', 'Duomo');
    nowCard().find('[data-cy="live-walk"]').should('not.contain.text', 'dalla tua posizione');
    cy.get('[data-cy="live-arrival"]').should('not.exist');
  });

  it('uscendo dalla guida la posizione non viene più seguita', () => {
    openAt(trip, '14:00');
    location().contains('button', 'Usa la mia posizione').click();
    fakeGeo().then(g => g.push(FAR));
    location().should('have.attr', 'data-status', 'on');
    cy.contains('a', 'Vai al pianificatore').click();
    cy.location('pathname').should('eq', `/trips/${trip.id}`);
    fakeGeo().its('cleared').should('be.gte', 1);
  });
});

import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #102 Coordinate di attività, ristoranti e alloggio: autocompletamento (stesso componente e stesso endpoint
 * della #63), "Trova sulla mappa" per le tappe con solo l'indirizzo e indicatore di posizione mancante.
 * Il servizio di geocodifica è finto: le risposte di /api/v1/places/poi sono fissate con cy.intercept.
 */
const BARCELLONA = { lat: 41.38879, lng: 2.15899 };
const DESTINATION = {
  destination: 'Barcellona', country: 'Spagna', destinationPlaceId: '3128760', destinationIntlName: 'Barcelona',
  destinationLat: BARCELLONA.lat, destinationLng: BARCELLONA.lng,
};
const CERVECERIA = {
  id: 'osm:1', name: 'Cervecería Catalana', address: 'Carrer de Mallorca 236, 08008 Barcelona, España',
  lat: 41.39237, lng: 2.16216, category: 'restaurant', source: 'osm',
};
const HOTEL = {
  id: 'osm:2', name: 'Hotel Arts Barcelona', address: 'Carrer de la Marina 19-21, 08005 Barcelona, España',
  lat: 41.38681, lng: 2.19626, category: 'hotel', source: 'osm',
};
const MUSEO = {
  id: 'osm:3', name: 'Museu Picasso', address: 'Carrer de Montcada 15-23, 08003 Barcelona, España',
  lat: 41.38522, lng: 2.18089, category: 'museum', source: 'osm',
};

/** Geocodifica finta: ogni ricerca restituisce `results`. */
function stubPoi(results: object[]) {
  cy.intercept('GET', '/api/v1/places/poi*', { body: { enabled: true, results } }).as('poi');
}

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(method: string, url: string, body?: Cypress.RequestBody) {
  return cy.apiToken('admin').then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

function openTrip(extra: Record<string, unknown> = {}) {
  const title = uniq('E2E Posizioni');
  return cy.createTrip('admin', GROUPS.esploratori, { title, ...DESTINATION, ...extra }).then(trip => {
    cy.visit(`/trips/${trip.id}`);
    cy.contains('h1', title).should('be.visible');
    return cy.wrap(trip.id as string);
  });
}

function openTab(label: string) {
  cy.contains('.trip-tab-btn', label).click().should('have.class', 'trip-tab-btn--active');
}

function options(inputId: string) {
  return cy.get(`#${inputId}-options [role="option"]`);
}

describe('Posizioni – ristoranti', () => {
  beforeEach(() => cy.login('admin'));

  it('il nome suggerisce i locali vicini alla destinazione e la scelta salva indirizzo e coordinate', () => {
    openTrip().then(tripId => {
      stubPoi([CERVECERIA]);
      openTab('Food & Drink');
      cy.get('.new-trip-btn').click();
      cy.dialog('Aggiungi Posto Dove Mangiare').within(() => {
        cy.get('#food_name').type('Cerveceria');
        cy.wait('@poi').its('request.query').should('deep.include', {
          q: 'Cerveceria', lat: String(BARCELLONA.lat), lng: String(BARCELLONA.lng),
        });
        options('food_name').first().should('contain', CERVECERIA.name).click();
        cy.get('#food_name').should('have.value', CERVECERIA.name);
        cy.get('#food_address').should('have.value', CERVECERIA.address);
        cy.contains('Posizione sulla mappa').should('be.visible');
        cy.contains('button', 'Salva Locale').click();
      });
      cy.toast(`Posto "${CERVECERIA.name}" aggiunto ai ristoranti!`).should('be.visible');
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.placesToEat[0]).to.include({ name: CERVECERIA.name, address: CERVECERIA.address });
        expect(t.placesToEat[0].coordinates).to.deep.equal({ lat: CERVECERIA.lat, lng: CERVECERIA.lng });
      });
    });
  });

  it('con solo l\'indirizzo: "Trova sulla mappa" propone il primo risultato e lo usa dopo la conferma', () => {
    openTrip().then(tripId => {
      stubPoi([CERVECERIA, HOTEL]);
      // La ricerca dell'indirizzo scritto (q = indirizzo), con priorità vicino alla destinazione.
      cy.intercept({ method: 'GET', pathname: '/api/v1/places/poi', query: { q: 'Mallorca 236' } },
        { body: { enabled: true, results: [CERVECERIA, HOTEL] } }).as('locate');
      openTab('Food & Drink');
      cy.get('.new-trip-btn').click();
      cy.dialog('Aggiungi Posto Dove Mangiare').within(() => {
        cy.get('#food_name').type('Da Mario').blur();
        cy.get('#food_address').type('Mallorca 236').blur();
        cy.contains('Posizione mancante').should('be.visible');

        cy.contains('button', 'Trova sulla mappa').click();
        cy.wait('@locate').its('request.query').should('deep.include', { lat: String(BARCELLONA.lat), lng: String(BARCELLONA.lng) });
        cy.contains('[role="status"]', 'Trovato:').should('contain', CERVECERIA.name).and('contain', CERVECERIA.address);
        cy.contains('button', 'Usa questa posizione').click();
        cy.contains('Posizione sulla mappa').should('be.visible');
        // L'indirizzo e il nome scritti restano.
        cy.get('#food_address').should('have.value', 'Mallorca 236');
        cy.get('#food_name').should('have.value', 'Da Mario');
        cy.contains('button', 'Salva Locale').click();
      });
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.placesToEat[0]).to.include({ name: 'Da Mario', address: 'Mallorca 236' });
        expect(t.placesToEat[0].coordinates).to.deep.equal({ lat: CERVECERIA.lat, lng: CERVECERIA.lng });
      });
    });
  });

  it('nessun risultato o "Annulla": il locale si salva senza coordinate (niente posizioni inventate)', () => {
    openTrip().then(tripId => {
      stubPoi([]);
      openTab('Food & Drink');
      cy.get('.new-trip-btn').click();
      cy.dialog('Aggiungi Posto Dove Mangiare').within(() => {
        cy.get('#food_name').type('Bar Sconosciuto').blur();
        cy.get('#food_address').type('Via Inesistente 1').blur();
        cy.contains('button', 'Trova sulla mappa').click();
        cy.wait('@poi');
        cy.contains('[role="status"]', 'Nessun luogo trovato per questo indirizzo.').should('be.visible');

        stubPoi([HOTEL]);
        cy.contains('button', 'Trova sulla mappa').click();
        cy.contains('[role="status"]', 'Trovato:').should('contain', HOTEL.name);
        cy.contains('button', 'Annulla').click();
        cy.contains('Posizione mancante').should('be.visible');
        cy.contains('button', 'Salva Locale').click();
      });
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.placesToEat).to.have.length(1);
        expect(t.placesToEat[0].coordinates ?? null).to.eq(null);
      });
    });
  });
});

describe('Posizioni – alloggio', () => {
  beforeEach(() => cy.login('admin'));

  function openAccommodation() {
    openTab('Logistica');
    cy.contains('.filter-pill-btn', 'Alloggio').click();
    cy.contains('.sub-section-title', 'Struttura & Prenotazione').parent().find('button').click();
    return cy.dialog('Dettagli Alloggio & Hotel');
  }

  it('ricerca della struttura, coordinate salvate e mantenute finché l\'indirizzo non cambia', () => {
    openTrip().then(tripId => {
      stubPoi([HOTEL]);
      openAccommodation().within(() => {
        cy.get('#accom_name').type('Hotel Arts');
        cy.wait('@poi').its('request.query').should('deep.include', { lat: String(BARCELLONA.lat) });
        options('accom_name').first().click();
        cy.get('#accom_address').should('have.value', HOTEL.address);
        cy.contains('Posizione sulla mappa').should('be.visible');
        cy.contains('button', 'Salva Alloggio').click();
      });
      cy.toast('Dettagli hotel aggiornati!').should('be.visible');
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.accommodation).to.include({ name: HOTEL.name, address: HOTEL.address });
        expect(t.accommodation.coordinates).to.deep.equal({ lat: HOTEL.lat, lng: HOTEL.lng });
      });

      // Riaperta: la posizione salvata vale ancora; altri campi modificati non la perdono.
      openAccommodation().within(() => {
        cy.contains('Posizione sulla mappa').should('be.visible');
        cy.get('input[formControlName="bookingCode"]').clear().type('ARTS-1');
        cy.contains('button', 'Salva Alloggio').click();
      });
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.accommodation).to.include({ bookingCode: 'ARTS-1' });
        expect(t.accommodation.coordinates).to.deep.equal({ lat: HOTEL.lat, lng: HOTEL.lng });
      });

      // Indirizzo cambiato a mano: la vecchia posizione non vale più.
      stubPoi([]);
      openAccommodation().within(() => {
        cy.get('#accom_address').clear().type('Passeig de Gràcia 1').blur();
        cy.contains('Posizione mancante').should('be.visible');
        cy.contains('button', 'Salva Alloggio').click();
      });
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.accommodation).to.include({ address: 'Passeig de Gràcia 1' });
        expect(t.accommodation.coordinates ?? null).to.eq(null);
      });

      // E si ritrova con "Trova sulla mappa".
      stubPoi([HOTEL]);
      openAccommodation().within(() => {
        cy.contains('button', 'Trova sulla mappa').click();
        cy.contains('button', 'Usa questa posizione').click();
        cy.contains('button', 'Salva Alloggio').click();
      });
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        expect(t.accommodation).to.include({ address: 'Passeig de Gràcia 1' });
        expect(t.accommodation.coordinates).to.deep.equal({ lat: HOTEL.lat, lng: HOTEL.lng });
      });
    });
  });
});

describe('Posizioni – itinerario', () => {
  /** Viaggio con, nel giorno 1, un'attività senza coordinate e un locale con le coordinate. */
  function tripWithStops() {
    return openTrip().then(tripId => {
      cy.api('admin', 'POST', `/api/v1/trips/${tripId}/activities`, {
        name: 'Museu Picasso', category: 'museum', address: 'Carrer de Montcada 15', ticketsRequired: false,
        bookingRequired: false, assignedDay: 1, startTime: '10:00',
      });
      cy.api('admin', 'POST', `/api/v1/trips/${tripId}/places-to-eat`, {
        name: CERVECERIA.name, category: 'lunch', priceRange: '€€', address: CERVECERIA.address, bookingRequired: false,
        assignedDay: 1, coordinates: { lat: CERVECERIA.lat, lng: CERVECERIA.lng },
      });
      cy.reload();
      return cy.wrap(tripId);
    });
  }

  beforeEach(() => cy.login('admin'));

  it('segnala la tappa senza posizione, la trova sulla mappa e la mostra sulla mappa', () => {
    tripWithStops().then(tripId => {
      cy.contains('.timeline-entry', CERVECERIA.name).find('.timeline-no-location').should('not.exist');
      cy.contains('.stops-count', '1 tappa sulla mappa');

      stubPoi([MUSEO]);
      cy.contains('.timeline-entry', 'Museu Picasso').within(() => {
        cy.contains('.timeline-no-location', 'Posizione mancante: aggiungila per avere le indicazioni.').should('be.visible');
        cy.get('button[aria-label="Trova sulla mappa: Museu Picasso"]').click();
      });
      cy.wait('@poi').its('request.query').should('deep.include', { q: 'Carrer de Montcada 15', lat: String(BARCELLONA.lat) });
      cy.contains('.timeline-entry', 'Museu Picasso').within(() => {
        cy.contains('[role="status"]', 'Trovato:').should('contain', MUSEO.name);
        cy.contains('button', 'Usa questa posizione').click();
      });
      cy.toast('Attrazione aggiornata!').should('be.visible');
      cy.contains('.timeline-entry', 'Museu Picasso').find('.timeline-no-location').should('not.exist');
      cy.contains('.stops-count', '2 tappe sulla mappa');
      cy.apiUntil('admin', `/api/v1/trips/${tripId}`, t => {
        const museo = t.activities[0];
        expect(museo.coordinates).to.deep.equal({ lat: MUSEO.lat, lng: MUSEO.lng });
        // Il resto della tappa non cambia.
        expect(museo).to.include({ address: 'Carrer de Montcada 15', startTime: '10:00', assignedDay: 1 });
      });
    });
  });

  it('su mobile l\'indicatore e il pulsante sono leggibili', () => {
    cy.viewport('iphone-x');
    tripWithStops().then(() => {
      cy.contains('.timeline-entry', 'Museu Picasso').within(() => {
        cy.contains('Posizione mancante').should('be.visible');
        cy.contains('button', 'Trova sulla mappa').should('be.visible');
      });
      cy.document().then(doc => {
        expect(doc.documentElement.scrollWidth, 'nessuno scorrimento orizzontale').to.be.at.most(doc.documentElement.clientWidth);
      });
    });
  });
});

describe('Posizioni – API', () => {
  it('rifiuta coordinate incomplete o fuori scala (400) e le accetta valide', () => {
    cy.createTrip('admin', GROUPS.esploratori, { title: uniq('E2E Coordinate API') }).then(trip => {
      const act = (coordinates: object) => ({
        name: 'X', category: 'other', address: '', ticketsRequired: false, bookingRequired: false, coordinates,
      });
      const url = `/api/v1/trips/${trip.id}/activities`;
      rawApi('POST', url, act({ lat: 41.4 })).its('status').should('eq', 400);
      rawApi('POST', url, act({ lat: 100, lng: 2 })).its('status').should('eq', 400);
      rawApi('POST', url, act({ lat: 41.4, lng: 200 })).its('status').should('eq', 400);
      rawApi('PUT', `/api/v1/trips/${trip.id}/accommodation`, { name: 'H', address: 'A', coordinates: { lng: 2 } })
        .its('status').should('eq', 400);
      rawApi('POST', url, act({ lat: 41.4, lng: 2.17 })).its('status').should('eq', 201);
    });
  });
});

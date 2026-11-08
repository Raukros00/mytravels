import { uniq } from '../support/e2e';
import { GROUPS, TRIPS } from '../support/users';

/**
 * #101 Orari strutturati (startTime/endTime) e ordine delle tappe nella giornata (dayOrder).
 * Le regole pure (riconoscimento delle fasce, ordinamento, sovrapposizioni) hanno anche i test unitari
 * in src/app/core/utils/day-schedule.utils.spec.ts.
 */

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(user: 'admin' | 'luca', method: string, url: string, body?: Cypress.RequestBody) {
  return cy.apiToken(user).then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

function activity(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'monument', address: '', ticketsRequired: false, bookingRequired: false, ...extra };
}

function place(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'lunch', priceRange: '€€', address: '', bookingRequired: false, ...extra };
}

/** Nomi delle tappe nell'ordine mostrato dall'itinerario. */
function stopNames() {
  return cy.get('.timeline-entry .timeline-name').then($els => [...$els].map(el => el.textContent!.trim()));
}

function stop(name: string) {
  return cy.contains('.timeline-entry', name);
}

/**
 * Viaggio di 2 giorni con, nel giorno 1: Duomo 09:00–11:00, Pinacoteca (fascia "15.00-17.00" scritta a mano,
 * convertita dal backend), Trattoria a pranzo senza orario (orario indicativo 12:30–14:00) e un Giro libero
 * ("pomeriggio": nessun orario).
 */
function createDayTrip() {
  const title = uniq('E2E Orari');
  return cy.createTrip('admin', GROUPS.esploratori, { title, startDate: '2027-05-03', endDate: '2027-05-04' }).then(trip => {
    const base = `/api/v1/trips/${trip.id}`;
    cy.api('admin', 'POST', `${base}/activities`, activity('Duomo', { assignedDay: 1, startTime: '09:00', endTime: '11:00' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Pinacoteca', { assignedDay: 1, timeSlot: '15.00-17.00' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Giro libero', { assignedDay: 1, timeSlot: 'pomeriggio' }));
    cy.api('admin', 'POST', `${base}/places-to-eat`, place('Trattoria', { assignedDay: 1, assignedMeal: 'lunch' }));
    return cy.wrap({ id: trip.id as string, title });
  });
}

function visitItinerary(trip: { id: string; title: string }) {
  cy.visit(`/trips/${trip.id}`);
  cy.contains('h1', trip.title).should('be.visible');
  cy.contains('.trip-tab-btn', 'Itinerario').should('have.class', 'trip-tab-btn--active');
}

describe('Orari delle tappe – API', () => {
  let tripId: string;

  before(() => {
    cy.createTrip('admin', GROUPS.esploratori, { title: uniq('E2E Orari API') }).then(t => (tripId = t.id));
  });

  it('una fascia scritta a mano riconoscibile diventa orario; il testo resta, quello libero resta intatto', () => {
    const base = `/api/v1/trips/${tripId}`;
    cy.api('admin', 'POST', `${base}/activities`, activity('A', { timeSlot: '10:00 - 12:30' }))
      .should('deep.include', { timeSlot: '10:00 - 12:30', startTime: '10:00', endTime: '12:30' });
    cy.api('admin', 'POST', `${base}/activities`, activity('B', { timeSlot: '9.30' }))
      .should('deep.include', { startTime: '09:30', endTime: null });
    cy.api('admin', 'POST', `${base}/places-to-eat`, place('C', { timeSlot: '22:00 - 01:00' }))
      .should('deep.include', { startTime: '22:00', endTime: null });
    cy.api('admin', 'POST', `${base}/places-to-eat`, place('D', { timeSlot: 'mattina' }))
      .should('deep.include', { timeSlot: 'mattina', startTime: null, endTime: null });
    // Gli orari impostati prevalgono sul testo.
    cy.api('admin', 'POST', `${base}/activities`, activity('E', { timeSlot: 'verso le 10', startTime: '10:15' }))
      .should('deep.include', { timeSlot: 'verso le 10', startTime: '10:15', endTime: null });
  });

  it('rifiuta orari non validi (400)', () => {
    const url = `/api/v1/trips/${tripId}/activities`;
    rawApi('admin', 'POST', url, activity('X', { startTime: '25:00' })).its('status').should('eq', 400);
    rawApi('admin', 'POST', url, activity('X', { startTime: '9:00' })).its('status').should('eq', 400);
    rawApi('admin', 'POST', url, activity('X', { endTime: '10:00' })).its('status').should('eq', 400);
    rawApi('admin', 'POST', url, activity('X', { startTime: '11:00', endTime: '10:00' })).its('status').should('eq', 400);
    rawApi('admin', 'POST', `/api/v1/trips/${tripId}/places-to-eat`, place('X', { startTime: '12:00', endTime: '12:00' }))
      .its('status').should('eq', 400);
  });

  it('salva l\'ordine del giorno; rifiuta tappe di altri giorni (400) e chi non è del gruppo (404)', () => {
    createDayTrip().then(trip => {
      cy.api<any>('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
        const duomo = t.activities.find((a: any) => a.name === 'Duomo');
        const trattoria = t.placesToEat.find((p: any) => p.name === 'Trattoria');
        const url = `/api/v1/trips/${trip.id}/days/1/order`;
        const items = [{ type: 'food', id: trattoria.id }, { type: 'activity', id: duomo.id }];

        rawApi('luca', 'PUT', url, { items }).its('status').should('eq', 404); // come per #76: per chi non è del gruppo il viaggio non esiste
        rawApi('admin', 'PUT', `/api/v1/trips/${trip.id}/days/2/order`, { items }).its('status').should('eq', 400);
        rawApi('admin', 'PUT', url, { items: [{ type: 'altro', id: duomo.id }] }).its('status').should('eq', 400);
        rawApi('admin', 'PUT', url, { items: [items[0], items[0]] }).its('status').should('eq', 400);
        rawApi('admin', 'PUT', '/api/v1/trips/id-inesistente/days/1/order', { items }).its('status').should('eq', 404);

        rawApi('admin', 'PUT', url, { items }).its('status').should('eq', 200);
        cy.api<any>('admin', 'GET', `/api/v1/trips/${trip.id}`).then(saved => {
          expect(saved.placesToEat.find((p: any) => p.id === trattoria.id).dayOrder).to.eq(0);
          expect(saved.activities.find((a: any) => a.id === duomo.id).dayOrder).to.eq(1);
        });
      });
    });
  });
});

describe('Orari delle tappe – itinerario', () => {
  let trip: { id: string; title: string };

  beforeEach(() => {
    cy.login('admin');
    createDayTrip().then(t => {
      trip = t;
      visitItinerary(t);
    });
  });

  it('mostra le tappe in ordine di orario, con il pranzo nella sequenza e le tappe senza orario in fondo', () => {
    stopNames().should('deep.equal', ['Duomo', 'Trattoria', 'Pinacoteca', 'Giro libero']);
    stop('Duomo').find('.timeline-time').should('have.text', '09:00–11:00');
    stop('Pinacoteca').find('.timeline-time').should('have.text', '15:00–17:00');
    stop('Trattoria').within(() => {
      cy.get('.timeline-time').should('have.text', '12:30–14:00');
      cy.contains('.timeline-time-default', 'indicativo').should('be.visible');
    });
    // Testo libero non convertibile: mostrato com'è.
    stop('Giro libero').find('.timeline-time').should('have.text', 'pomeriggio');
    cy.get('.timeline-overlap').should('not.exist');

    // L'orario indicativo del pranzo non viene salvato.
    cy.api<any>('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
      expect(t.placesToEat[0]).to.include({ startTime: null, endTime: null });
    });
  });

  it('modifica gli orari dalla modale, con validazione e avviso di sovrapposizione', () => {
    stop('Duomo').contains('button', 'Orario').click();
    cy.dialog('Pianifica nel Giorno').within(() => {
      cy.get('#assign_start').should('have.value', '09:00');
      cy.get('#assign_end').should('have.value', '11:00');

      // Fine prima dell'inizio: errore e conferma disattivata.
      cy.get('#assign_end').clear().type('08:00');
      cy.get('[role="alert"]').should('contain.text', 'La fine deve essere dopo l\'inizio');
      cy.contains('button', 'Conferma').should('be.disabled');

      cy.get('#assign_start').clear().type('12:00');
      cy.get('#assign_end').clear().type('13:00');
      cy.get('[role="alert"]').should('not.exist');
      cy.contains('button', 'Conferma').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.toast('Attrazione aggiornata!').should('be.visible');

    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, t => {
      expect(t.activities.find((a: any) => a.name === 'Duomo'))
        .to.include({ startTime: '12:00', endTime: '13:00', timeSlot: '12:00 - 13:00', assignedDay: 1 });
    });

    // Si sovrappone al pranzo (orario indicativo 12:30–14:00): avviso su entrambe le tappe.
    stop('Duomo').find('.timeline-overlap').should('contain.text', 'Orario sovrapposto con Trattoria');
    stop('Trattoria').find('.timeline-overlap').should('contain.text', 'Orario sovrapposto con Duomo');
    stopNames().should('deep.equal', ['Duomo', 'Trattoria', 'Pinacoteca', 'Giro libero']);

    // Pranzo spostato alle 13:00–14:00: il Duomo (12:00–13:00) non si sovrappone più.
    stop('Trattoria').contains('button', 'Orario').click();
    cy.dialog('Pianifica nel Giorno').within(() => {
      cy.contains('#assign_time_hint', 'indicativo del pasto (12:30–14:00)');
      cy.get('#assign_start').should('have.value', '');
      cy.get('#assign_start').type('13:00');
      cy.get('#assign_end').type('14:00');
      cy.contains('button', 'Conferma').click();
    });
    cy.toast('Locale aggiornato!').should('be.visible');
    cy.get('.timeline-overlap').should('not.exist');
    stop('Trattoria').within(() => {
      cy.get('.timeline-time').should('have.text', '13:00–14:00');
      cy.get('.timeline-time-default').should('not.exist');
    });
    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, t => {
      expect(t.placesToEat[0]).to.include({ startTime: '13:00', endTime: '14:00' });
    });
  });

  it('una nota libera senza orari resta come testo; togliere gli orari li azzera', () => {
    stop('Pinacoteca').contains('button', 'Orario').click();
    cy.dialog('Pianifica nel Giorno').within(() => {
      cy.get('#assign_start').should('have.value', '15:00');
      cy.get('#assign_note').should('have.value', '');
      cy.get('#assign_start').clear();
      cy.get('#assign_end').clear();
      cy.get('#assign_note').type('dopo pranzo');
      cy.contains('button', 'Conferma').click();
    });
    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, t => {
      expect(t.activities.find((a: any) => a.name === 'Pinacoteca'))
        .to.include({ startTime: null, endTime: null, timeSlot: 'dopo pranzo' });
    });
    stop('Pinacoteca').find('.timeline-time').should('have.text', 'dopo pranzo');
    // Senza orario né ordine scelto: in fondo.
    stopNames().should('deep.equal', ['Duomo', 'Trattoria', 'Giro libero', 'Pinacoteca']);
  });

  it('riordina con le frecce, salva l\'ordine con una sola richiesta e lo mantiene dopo il ricaricamento', () => {
    cy.intercept('PUT', `/api/v1/trips/${trip.id}/days/1/order`).as('order');
    stop('Duomo').find('button[aria-label="Sposta prima: Duomo"]').should('be.disabled');
    stop('Giro libero').find('button[aria-label="Sposta dopo: Giro libero"]').should('be.disabled');

    stop('Pinacoteca').find('button[aria-label="Sposta prima: Pinacoteca"]').click();
    stopNames().should('deep.equal', ['Duomo', 'Pinacoteca', 'Trattoria', 'Giro libero']);
    cy.wait('@order').then(({ request, response }) => {
      expect(response!.statusCode).to.eq(200);
      expect(request.body.items.map((i: any) => i.type)).to.deep.equal(['activity', 'activity', 'food', 'activity']);
    });
    cy.contains('[aria-live="polite"]', 'Pinacoteca spostata in posizione 2 di 4.');

    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, t => {
      const order = (name: string) =>
        [...t.activities, ...t.placesToEat].find((s: any) => s.name === name).dayOrder;
      expect(['Duomo', 'Pinacoteca', 'Trattoria', 'Giro libero'].map(order)).to.deep.equal([0, 1, 2, 3]);
    });

    cy.reload();
    stopNames().should('deep.equal', ['Duomo', 'Pinacoteca', 'Trattoria', 'Giro libero']);
  });

  it('una tappa con orario aggiunta dopo il riordino si inserisce in base all\'orario', () => {
    stop('Giro libero').find('button[aria-label="Sposta prima: Giro libero"]').click();
    stopNames().should('deep.equal', ['Duomo', 'Trattoria', 'Giro libero', 'Pinacoteca']);
    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, t => {
      expect(t.activities.find((a: any) => a.name === 'Pinacoteca').dayOrder).to.eq(3);
    });

    cy.api('admin', 'POST', `/api/v1/trips/${trip.id}/activities`, activity('Castello', { assignedDay: 1, startTime: '10:00' }));
    cy.reload();
    stopNames().should('deep.equal', ['Duomo', 'Castello', 'Trattoria', 'Giro libero', 'Pinacoteca']);
  });

  it('riordina trascinando la tappa (desktop)', () => {
    cy.intercept('PUT', `/api/v1/trips/${trip.id}/days/1/order`).as('order');
    const dataTransfer = new DataTransfer();
    stop('Giro libero').trigger('dragstart', { dataTransfer });
    stop('Duomo').trigger('dragover', { dataTransfer }).should('have.class', 'timeline-entry--drop-target');
    stop('Duomo').trigger('drop', { dataTransfer });
    stop('Giro libero').trigger('dragend', { dataTransfer });
    stopNames().should('deep.equal', ['Giro libero', 'Duomo', 'Trattoria', 'Pinacoteca']);
    cy.wait('@order').its('response.statusCode').should('eq', 200);
    cy.get('.timeline-entry--drop-target').should('not.exist');
  });

  it('se il salvataggio dell\'ordine fallisce, l\'ordine torna com\'era con un avviso', () => {
    cy.intercept('PUT', `/api/v1/trips/${trip.id}/days/1/order`, { statusCode: 503, body: {} }).as('order');
    stop('Trattoria').find('button[aria-label="Sposta dopo: Trattoria"]').click();
    cy.wait('@order');
    cy.toast('Non è stato possibile salvare l\'ordine delle tappe').should('be.visible');
    stopNames().should('deep.equal', ['Duomo', 'Trattoria', 'Pinacoteca', 'Giro libero']);
  });
});

describe('Orari delle tappe – mobile', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.login('admin');
  });

  it('frecce e campi ora utilizzabili su telefono, senza maniglia di trascinamento', () => {
    createDayTrip().then(trip => {
      visitItinerary(trip);
      cy.get('.timeline-drag-handle').should('not.be.visible');
      stop('Trattoria').find('button[aria-label="Sposta dopo: Trattoria"]').should('be.visible').then($btn => {
        const r = $btn[0].getBoundingClientRect();
        expect(r.width, 'area di tocco').to.be.at.least(36);
        expect(r.height, 'area di tocco').to.be.at.least(36);
      });
      stop('Trattoria').find('button[aria-label="Sposta dopo: Trattoria"]').click();
      stopNames().should('deep.equal', ['Duomo', 'Pinacoteca', 'Trattoria', 'Giro libero']);

      stop('Giro libero').contains('button', 'Orario').click();
      cy.dialog('Pianifica nel Giorno').within(() => {
        cy.get('#assign_start').should('be.visible').type('08:00');
        cy.get('#assign_end').should('be.visible').type('08:30');
        cy.contains('button', 'Conferma').click();
      });
      cy.toast('Attrazione aggiornata!').should('be.visible');
      stop('Giro libero').find('.timeline-time').should('have.text', '08:00–08:30');
      // Con l'orario cambiato la tappa si riposiziona in base all'orario.
      stopNames().should('deep.equal', ['Giro libero', 'Duomo', 'Pinacoteca', 'Trattoria']);
    });
  });
});

describe('Orari delle tappe – dati demo', () => {
  it('le fasce dei dati demo sono convertite e l\'itinerario le mostra in ordine', () => {
    cy.login('admin');
    cy.groupByName('admin', GROUPS.esploratori).then(group =>
      cy.api<any[]>('admin', 'GET', `/api/v1/trips/group/${group.id}`).then(trips => {
        const t = trips.find(x => x.title === TRIPS.barcellona);
        expect(t.activities.find((a: any) => a.name === 'Sagrada Família'))
          .to.include({ timeSlot: '10:00 - 12:30', startTime: '10:00', endTime: '12:30' });
        expect(t.placesToEat.find((p: any) => p.name === 'Bar Mut')).to.include({ startTime: '13:30', endTime: null });
        cy.visit(`/trips/${t.id}`);
      }),
    );
    stopNames().should('deep.equal', ['Sagrada Família', 'Bar Mut', 'Park Güell', 'El Xampanyet']);
  });
});

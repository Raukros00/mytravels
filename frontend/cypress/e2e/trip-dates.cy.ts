import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

const END_BEFORE_START = 'La data di fine non può precedere la data di inizio.';

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(method: string, url: string, body?: unknown) {
  return cy.apiToken('admin').then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

function newTripBody(groupId: string, overrides: Record<string, unknown> = {}) {
  return {
    groupId,
    title: uniq('E2E Date'),
    destination: 'Torino',
    country: 'Italia',
    startDate: '2027-06-10',
    endDate: '2027-06-13',
    decision: 'confirmed',
    ...overrides,
  };
}

describe('Date del viaggio – form di creazione', () => {
  beforeEach(() => {
    cy.login('admin');
    cy.visit('/trips/new');
    cy.get('#groupId option').should('have.length.gte', 2);
    cy.get('#title').type(uniq('E2E Date invertite'));
    cy.get('#destination').type('Bari');
  });

  it('non permette di salvare una fine precedente all\'inizio e spiega il motivo', () => {
    cy.intercept('POST', '/api/v1/trips', cy.spy().as('create'));
    cy.get('#startDate').clear().type('2027-05-10');
    // Il campo fine non propone giorni prima dell'inizio.
    cy.get('#endDate').should('have.attr', 'min', '2027-05-10');
    cy.get('#endDate').clear().type('2027-05-08');

    cy.contains('.form-error', END_BEFORE_START).should('be.visible');
    cy.get('#endDate').should('have.attr', 'aria-invalid', 'true');
    cy.contains('button', 'Crea Viaggio').should('be.disabled');
    // Con il pulsante disabilitato neanche Invio invia il form.
    cy.get('#title').type('{enter}');
    cy.location('pathname').should('eq', '/trips/new');
    cy.get('@create').should('not.have.been.called');

    // Correggendo la data l'errore sparisce e si può salvare.
    cy.get('#endDate').clear().type('2027-05-12');
    cy.contains('.form-error', END_BEFORE_START).should('not.exist');
    cy.contains('button', 'Crea Viaggio').should('be.enabled');
  });

  it('inizio e fine nello stesso giorno sono validi', () => {
    cy.intercept('POST', '/api/v1/trips').as('create');
    cy.get('#startDate').clear().type('2027-05-10');
    cy.get('#endDate').clear().type('2027-05-10');
    cy.contains('.form-error', END_BEFORE_START).should('not.exist');
    cy.contains('button', 'Crea Viaggio').click();
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.location('pathname').should('match', /^\/trips\/[\w-]+$/);
  });
});

describe('Date del viaggio – API', () => {
  let groupId: string;

  before(() => {
    cy.groupByName('admin', GROUPS.esploratori).then(g => (groupId = g.id));
  });

  it('la creazione rifiuta date invertite con 400 e un messaggio', () => {
    rawApi('POST', '/api/v1/trips', newTripBody(groupId, { startDate: '2027-06-10', endDate: '2027-06-09' })).then(res => {
      expect(res.status).to.eq(400);
      expect(res.body.message).to.eq(END_BEFORE_START);
    });
  });

  it('la creazione rifiuta date in formato non valido', () => {
    const invalid: Array<[string, string, string]> = [
      ['10/06/2027', '2027-06-13', 'Data di inizio non valida'],
      ['2027-06-10', '2027-6-13', 'Data di fine non valida'],
      ['2027-02-30', '2027-03-02', 'Data di inizio non valida'],
      ['2027-06-10', '', 'Data di fine non valida'],
    ];
    invalid.forEach(([startDate, endDate, message]) => {
      rawApi('POST', '/api/v1/trips', newTripBody(groupId, { startDate, endDate })).then(res => {
        expect(res.status, `${startDate} → ${endDate}`).to.eq(400);
        expect(res.body.message).to.contain(message).and.contain('yyyy-MM-dd');
      });
    });
  });

  it('la creazione accetta inizio e fine nello stesso giorno', () => {
    rawApi('POST', '/api/v1/trips', newTripBody(groupId, { startDate: '2027-06-10', endDate: '2027-06-10' })).then(res => {
      expect(res.status).to.eq(201);
      expect(res.body).to.include({ startDate: '2027-06-10', endDate: '2027-06-10' });
    });
  });

  it('la modifica rifiuta date invertite o non valide e lascia il viaggio com\'era', () => {
    cy.createTrip('admin', GROUPS.esploratori, { startDate: '2027-06-10', endDate: '2027-06-13' }).then(trip => {
      const url = `/api/v1/trips/${trip.id}`;
      // Solo la fine, prima dell'inizio salvato.
      rawApi('PUT', url, { endDate: '2027-06-01' }).then(res => {
        expect(res.status).to.eq(400);
        expect(res.body.message).to.eq(END_BEFORE_START);
      });
      // Solo l'inizio, dopo la fine salvata.
      rawApi('PUT', url, { startDate: '2027-06-20' }).then(res => {
        expect(res.status).to.eq(400);
        expect(res.body.message).to.eq(END_BEFORE_START);
      });
      // Formato non valido.
      rawApi('PUT', url, { startDate: '2027/06/11' }).then(res => {
        expect(res.status).to.eq(400);
        expect(res.body.message).to.contain('Data di inizio non valida');
      });
      cy.api('admin', 'GET', url).should('include', { startDate: '2027-06-10', endDate: '2027-06-13' });

      // Spostare entrambe le date in un colpo solo, in ordine, è valido.
      cy.api('admin', 'PUT', url, { startDate: '2027-07-01', endDate: '2027-07-03' })
        .should('include', { startDate: '2027-07-01', endDate: '2027-07-03' });
      // Le modifiche che non toccano le date continuano a funzionare.
      cy.api('admin', 'PUT', url, { ...trip, startDate: '2027-07-01', endDate: '2027-07-03', notes: 'Note aggiornate' })
        .should('include', { notes: 'Note aggiornate' });
    });
  });
});

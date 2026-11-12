import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #103 Modalità "In viaggio": guida della giornata (/trips/:id/live).
 * L'ora è simulata con cy.clock (solo `Date`: i timer restano reali). La logica adesso / dopo / giornata ha anche
 * i test unitari in src/app/core/utils/live-day.utils.spec.ts.
 *
 * Viaggio di prova a Torino, 2–4 luglio 2030 (lontano dalle date degli altri spec):
 *  - giorno 1 (2/7): niente in programma, un'idea nel backlog (Parco del Valentino);
 *  - giorno 2 (3/7): Duomo 09:00–11:00, Trattoria a pranzo (orario indicativo 12:30–14:00),
 *    Museo Egizio 15:00–17:00, Passeggiata in centro (senza orario);
 *  - giorno 3 (4/7): Mole Antonelliana 10:00–12:00.
 */

const DAY1 = '2030-07-02';
const DAY2 = '2030-07-03';
const DAY3 = '2030-07-04';

interface LiveTrip { id: string; title: string }

function activity(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'monument', address: 'Torino', ticketsRequired: false, bookingRequired: false, ...extra };
}

function createLiveTrip(): Cypress.Chainable<LiveTrip> {
  const title = uniq('E2E In viaggio');
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Torino', startDate: DAY1, endDate: DAY3 }).then(trip => {
    const base = `/api/v1/trips/${trip.id}`;
    cy.api('admin', 'POST', `${base}/activities`, activity('Duomo', { assignedDay: 2, startTime: '09:00', endTime: '11:00', address: 'Piazza San Giovanni' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Museo Egizio', { assignedDay: 2, startTime: '15:00', endTime: '17:00', ticketsRequired: true, ticketPrice: 18 }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Passeggiata in centro', { assignedDay: 2 }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Mole Antonelliana', { assignedDay: 3, startTime: '10:00', endTime: '12:00' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Parco del Valentino', { assignedDay: null }));
    cy.api('admin', 'POST', `${base}/places-to-eat`, {
      name: 'Trattoria', category: 'lunch', priceRange: '€€', address: 'Via Roma 1', bookingRequired: false,
      assignedDay: 2, assignedMeal: 'lunch'
    });
    cy.api('admin', 'PUT', `${base}/accommodation`, { name: 'Hotel Centrale', address: 'Via Po 10' });
    return cy.wrap({ id: trip.id as string, title });
  });
}

/** Apre la guida con l'ora locale indicata (`yyyy-MM-ddTHH:mm`). */
function openAt(trip: LiveTrip, localDateTime: string) {
  const [date, time] = localDateTime.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
  cy.visit(`/trips/${trip.id}/live`);
  cy.contains('.live-trip-title', trip.title).should('be.visible');
}

const nowCard = () => cy.get('[data-cy="live-now"]');
const dayItem = (name: string) => cy.contains('.live-timeline-item', name);

describe('In viaggio – guida della giornata', () => {
  let trip: LiveTrip;

  before(() => {
    createLiveTrip().then(t => (trip = t));
  });

  beforeEach(() => cy.login('admin'));

  it('durante una tappa: adesso, dopo e la giornata completa', () => {
    openAt(trip, `${DAY2}T10:30`);
    cy.contains('h1', 'Giorno 2 di 3 · Torino').should('be.visible');
    cy.get('.live-date').should('contain.text', '3 luglio').and('contain.text', '10:30');

    nowCard().within(() => {
      cy.get('.live-now-label').should('have.text', 'Adesso');
      cy.get('.live-now-name').should('have.text', 'Duomo');
      cy.contains('09:00–11:00');
      cy.contains('Piazza San Giovanni');
      cy.contains('button', 'Fatto').should('be.visible');
      cy.contains('button', 'Salta').should('be.visible');
      cy.contains('a', 'Indicazioni').should('have.attr', 'href').and('contain', 'google.com/maps');
    });

    cy.get('[data-cy="live-after"] .live-after-name').then($els =>
      expect([...$els].map(e => e.textContent!.trim())).to.deep.equal(['Trattoria', 'Museo Egizio']));

    cy.get('.live-timeline-item .live-timeline-name').then($els =>
      expect([...$els].map(e => e.textContent!.trim())).to.deep.equal(['Duomo', 'Trattoria', 'Museo Egizio', 'Passeggiata in centro']));
    dayItem('Duomo').should('have.attr', 'data-status', 'current').find('.live-status').should('have.text', 'In corso');
    dayItem('Trattoria').should('have.attr', 'data-status', 'todo');
  });

  it('prima della prima tappa: la giornata inizia alle 09:00', () => {
    openAt(trip, `${DAY2}T08:00`);
    nowCard().within(() => {
      cy.get('.live-now-label').should('have.text', 'La giornata inizia alle 09:00');
      cy.get('.live-now-name').should('have.text', 'Duomo');
    });
    dayItem('Duomo').should('have.attr', 'data-status', 'next');
  });

  it('tra due tappe: la prossima con il tempo che manca; quella passata è "non segnata"', () => {
    openAt(trip, `${DAY2}T11:30`);
    nowCard().within(() => {
      cy.get('.live-now-label').should('have.text', 'Prossima tappa · tra 1 h');
      cy.get('.live-now-name').should('have.text', 'Trattoria');
      cy.contains('orario indicativo');
    });
    dayItem('Duomo').should('have.attr', 'data-status', 'missed').contains('button', 'Fatta');
  });

  it('dopo l\'ultima tappa con orario arriva il turno di quella senza orario', () => {
    openAt(trip, `${DAY2}T18:00`);
    nowCard().find('.live-now-name').should('have.text', 'Passeggiata in centro');
    nowCard().find('.live-now-label').should('have.text', 'Adesso · senza orario');
  });

  it('prima del viaggio: messaggio e link al pianificatore', () => {
    openAt(trip, '2030-06-30T10:00');
    cy.get('[data-cy="live-not-started"]').within(() => {
      cy.contains('Il viaggio non è ancora iniziato');
      cy.contains('Mancano 2 giorni alla partenza');
      cy.contains('a', 'Apri il pianificatore').should('have.attr', 'href', `/trips/${trip.id}`);
    });
  });

  // Test separato: `cy.clock` si installa una sola volta per test, un secondo `openAt` non sposterebbe l'ora.
  it('dopo il viaggio: messaggio e link al pianificatore', () => {
    openAt(trip, '2030-07-06T10:00');
    cy.get('[data-cy="live-ended"]').should('contain.text', 'Il viaggio è finito')
      .find('a').should('have.attr', 'href', `/trips/${trip.id}`);
  });

  it('dalla guida si torna al pianificatore, e dal pianificatore si apre la guida durante il viaggio', () => {
    openAt(trip, `${DAY2}T10:30`);
    cy.contains('a', 'Vai al pianificatore').click();
    cy.location('pathname').should('eq', `/trips/${trip.id}`);
    cy.contains('a.live-banner', 'Apri la guida di oggi').click();
    cy.location('pathname').should('eq', `/trips/${trip.id}/live`);
  });

  it('su mobile i pulsanti sono grandi e la pagina non scorre in orizzontale', () => {
    cy.viewport('iphone-x');
    openAt(trip, `${DAY2}T10:30`);
    nowCard().find('.live-action').should('have.length', 3).each($b => {
      expect($b[0].getBoundingClientRect().height).to.be.gte(56);
      expect($b[0].getBoundingClientRect().width).to.be.gte(80);
    });
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth));
  });
});

describe('In viaggio – Fatto e Salta', () => {
  let trip: LiveTrip;

  beforeEach(() => {
    cy.login('admin');
    createLiveTrip().then(t => (trip = t));
  });

  it('Fatto segna la tappa (visibile agli altri membri) e passa alla successiva; Annulla la rimette da fare', () => {
    openAt(trip, `${DAY2}T10:30`);
    nowCard().contains('button', 'Fatto').click();
    cy.toast('"Duomo" fatto ✓').should('be.visible');
    nowCard().find('.live-now-name').should('have.text', 'Trattoria');
    dayItem('Duomo').should('have.attr', 'data-status', 'done');

    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, (t: any) => {
      expect(t.activities.find((a: any) => a.name === 'Duomo')).to.include({ isCompleted: true, isSkipped: false });
    });

    // Un altro membro del gruppo lo vede al caricamento.
    cy.login('sofia');
    openAt(trip, `${DAY2}T10:30`);
    dayItem('Duomo').should('have.attr', 'data-status', 'done');
    nowCard().find('.live-now-name').should('have.text', 'Trattoria');

    dayItem('Duomo').contains('button', 'Annulla').click();
    dayItem('Duomo').should('have.attr', 'data-status', 'current');
    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, (t: any) => {
      expect(t.activities.find((a: any) => a.name === 'Duomo')).to.include({ isCompleted: false, isSkipped: false });
    });
  });

  it('Salta segna la tappa come saltata (anche per un ristorante) e la mostra nel pianificatore', () => {
    openAt(trip, `${DAY2}T11:30`);
    nowCard().find('.live-now-name').should('have.text', 'Trattoria');
    nowCard().contains('button', 'Salta').click();
    cy.toast('"Trattoria" saltato.').should('be.visible');
    dayItem('Trattoria').should('have.attr', 'data-status', 'skipped').find('.live-status').should('have.text', 'Saltata');
    nowCard().find('.live-now-name').should('have.text', 'Museo Egizio');

    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, (t: any) => {
      expect(t.placesToEat[0]).to.include({ isSkipped: true, isVisited: false });
    });

    // Itinerario del pianificatore, giorno 2: badge "Saltata".
    cy.visit(`/trips/${trip.id}`);
    cy.contains('button', 'Giorno 2').click();
    cy.contains('.timeline-entry', 'Trattoria').find('.badge-skipped').should('contain.text', 'Saltata');
  });

  it('a fine giornata: riepilogo, rientro all\'alloggio e programma di domani', () => {
    cy.api<any>('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
      const duomo = t.activities.find((a: any) => a.name === 'Duomo');
      cy.api('admin', 'PUT', `/api/v1/trips/${trip.id}/activities/${duomo.id}`, { ...duomo, isCompleted: true });
    });
    openAt(trip, `${DAY2}T21:30`);
    // Senza orario la passeggiata resta da fare: la si segna.
    nowCard().find('.live-now-name').should('have.text', 'Passeggiata in centro');
    nowCard().contains('button', 'Fatto').click();

    cy.get('[data-cy="live-finished"]').within(() => {
      cy.contains('Giornata completata');
      cy.get('.live-finished-counts').should('contain.text', '2 tappe fatte').and('contain.text', '2 rimaste da fare');
      cy.contains('.live-home', 'Hotel Centrale').find('a').should('have.attr', 'href').and('contain', 'google.com/maps');
      cy.get('[data-cy="live-tomorrow"]').should('contain.text', 'Domani').and('contain.text', '10:00–12:00 Mole Antonelliana');
    });
    dayItem('Trattoria').should('have.attr', 'data-status', 'missed');
  });

  it('ultimo giorno: dopo l\'ultima tappa il messaggio di fine viaggio', () => {
    openAt(trip, `${DAY3}T20:00`);
    cy.contains('h1', 'Giorno 3 di 3 · Torino');
    cy.get('[data-cy="live-finished"]').should('contain.text', 'Era l\'ultimo giorno del viaggio');
  });

  it('giornata vuota: messaggio e idee dal backlog da aggiungere a oggi', () => {
    openAt(trip, `${DAY1}T10:00`);
    cy.get('[data-cy="live-empty"]').within(() => {
      cy.contains('Oggi non c\'è niente in programma');
      cy.contains('.live-backlog-item', 'Parco del Valentino').contains('button', 'Aggiungi a oggi').click();
    });
    nowCard().find('.live-now-name').should('have.text', 'Parco del Valentino');
    cy.apiUntil('admin', `/api/v1/trips/${trip.id}`, (t: any) => {
      expect(t.activities.find((a: any) => a.name === 'Parco del Valentino').assignedDay).to.eq(1);
    });
  });
});

describe('In viaggio – orario simulato con ?now=', () => {
  beforeEach(() => cy.login('admin'));

  it('fuori produzione ?now= simula data e ora (la scelta resta nella scheda finché non si usa ?now=off)', () => {
    createLiveTrip().then(trip => {
      cy.visit(`/trips/${trip.id}/live?now=${DAY2}T10:30`);
      cy.contains('h1', 'Giorno 2 di 3 · Torino').should('be.visible');
      cy.contains('.live-simulated', 'orario simulato').should('be.visible');
      nowCard().find('.live-now-name').should('have.text', 'Duomo');

      // Ricaricando senza parametro la simulazione resta.
      cy.visit(`/trips/${trip.id}/live`);
      cy.contains('h1', 'Giorno 2 di 3 · Torino').should('be.visible');

      cy.visit(`/trips/${trip.id}/live?now=off`);
      cy.get('.live-simulated').should('not.exist');
    });
  });
});

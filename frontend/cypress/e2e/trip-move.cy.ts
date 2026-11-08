import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #112 Spostare le tappe tra i giorni: "Da recuperare", pannello "Sposta" con carico, fasce libere, avvisi di
 * chiusura e giorno consigliato, "Annulla", ripasso di fine giornata. La logica del giorno consigliato ha i test
 * unitari in src/app/core/utils/reschedule.utils.spec.ts. Ora simulata con cy.clock (solo `Date`).
 *
 * Viaggio a Roma, da lunedì 2 a giovedì 5 settembre 2030:
 *  - giorno 1 (lun): Colosseo 09:00–12:00 (chiuso il giovedì, aperto 9:00-19:00), Fori Imperiali 15:00–17:00;
 *  - giorno 2 (mar): Vaticano 09:00–13:00, Trastevere 15:00–19:00 (giornata piena);
 *  - giorno 3 (mer): Pantheon 10:00–11:00;
 *  - giorno 4 (gio): libero.
 * Per il Colosseo il giorno consigliato è il 3 (il 4 è chiuso, il 2 non ha 3 ore libere entro le 19:00).
 */

interface MoveTrip { id: string; title: string }

const DAY1 = '2030-09-02';
const DAY2 = '2030-09-03';

function activity(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'monument', address: 'Roma', ticketsRequired: false, bookingRequired: false, ...extra };
}

function createMoveTrip(): Cypress.Chainable<MoveTrip> {
  const title = uniq('E2E Sposta');
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Roma', startDate: DAY1, endDate: '2030-09-05' }).then(trip => {
    const base = `/api/v1/trips/${trip.id}/activities`;
    cy.api('admin', 'POST', base, activity('Colosseo', {
      assignedDay: 1, startTime: '09:00', endTime: '12:00', closingDays: 'Giovedì', openingHours: '9:00-19:00', ticketsRequired: true
    }));
    cy.api('admin', 'POST', base, activity('Fori Imperiali', { assignedDay: 1, startTime: '15:00', endTime: '17:00' }));
    cy.api('admin', 'POST', base, activity('Vaticano', { assignedDay: 2, startTime: '09:00', endTime: '13:00' }));
    cy.api('admin', 'POST', base, activity('Trastevere', { assignedDay: 2, startTime: '15:00', endTime: '19:00' }));
    cy.api('admin', 'POST', base, activity('Pantheon', { assignedDay: 3, startTime: '10:00', endTime: '11:00' }));
    return cy.wrap({ id: trip.id as string, title });
  });
}

function at(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
}

function activityOf(tripId: string, name: string, assert: (a: any) => void) {
  return cy.apiUntil('admin', `/api/v1/trips/${tripId}`, (t: any) => assert(t.activities.find((a: any) => a.name === name)));
}

const panel = () => cy.get('[data-cy="move-panel"]');
const dayOption = (day: number) => panel().find(`.move-day[data-day="${day}"]`);

describe('Spostare le tappe tra i giorni', () => {
  let trip: MoveTrip;

  beforeEach(() => {
    cy.login('admin');
    createMoveTrip().then(t => (trip = t));
  });

  it('ripasso di fine giornata: le tappe rimaste, il pannello con il giorno consigliato, lo spostamento e Annulla', () => {
    at(DAY1, '22:00');
    cy.visit(`/trips/${trip.id}/live`);
    cy.get('[data-cy="live-review"]').within(() => {
      cy.contains('Oggi sono rimaste 2 tappe');
      cy.contains('strong', 'Colosseo, Fori Imperiali');
      cy.contains('li', 'Colosseo').contains('button', 'Sposta').click();
    });

    panel().within(() => {
      cy.get('[data-cy="move-recommendation"]').should('contain.text', 'Consigliato: Giorno 3').and('contain.text', 'alle 11:00');
      cy.get('.move-day').should('have.length', 3); // giorni 2, 3, 4 (non quello attuale)
    });
    dayOption(2).should('contain.text', '2 tappe · 8 h occupate')
      .and('contain.text', 'Libero 13:00–15:00, dalle 19:00')
      .and('contain.text', 'Orari di apertura (9:00-19:00) incompatibili');
    dayOption(3).should('contain.text', 'Consigliato').and('contain.text', '1 tappa · 1 h occupate')
      .and('contain.text', 'Andrebbe alle 11:00–14:00')
      .and('have.attr', 'aria-pressed', 'true');
    dayOption(4).should('contain.text', 'Chiuso di giovedì').and('contain.text', 'Nessuna tappa');
    panel().should('contain.text', 'ricordati di cambiare la data'); // ha i biglietti
    panel().find('#move_start').should('have.value', '11:00');
    panel().find('#move_end').should('have.value', '14:00');
    panel().contains('button', 'Sposta al Giorno 3').click();

    cy.get('[data-cy="move-undo"]').should('contain.text', '"Colosseo" spostato al giorno 3 alle 11:00.');
    activityOf(trip.id, 'Colosseo', a => expect(a).to.include({ assignedDay: 3, startTime: '11:00', endTime: '14:00', isSkipped: false }));
    cy.get('[data-cy="live-review"]').should('not.contain.text', 'Colosseo');

    cy.get('[data-cy="move-undo"]').contains('button', 'Annulla').click();
    activityOf(trip.id, 'Colosseo', a => expect(a).to.include({ assignedDay: 1, startTime: '09:00', endTime: '12:00' }));
    cy.get('[data-cy="live-review"]').should('contain.text', 'Colosseo');
  });

  it('Salta e "Da recuperare": nella guida e nel pianificatore; lo spostamento è visibile al gruppo', () => {
    at(DAY2, '10:00');
    cy.visit(`/trips/${trip.id}/live`);
    // Le tappe non fatte di ieri sono da recuperare.
    cy.get('[data-cy="live-recover"]').within(() => {
      cy.contains('.live-recover-item', 'Colosseo').should('contain.text', 'Giorno 1 · non fatta');
      cy.contains('.live-recover-item', 'Fori Imperiali');
    });
    // Saltata oggi: resta nella giornata, con "Sposta".
    cy.get('[data-cy="live-now"]').contains('button', 'Salta').click();
    cy.contains('.live-timeline-item', 'Vaticano').should('have.attr', 'data-status', 'skipped')
      .find('button').contains('Sposta').should('be.visible');

    activityOf(trip.id, 'Vaticano', a => expect(a).to.include({ isSkipped: true }));

    // Nel pianificatore: la lista "Da recuperare" con le saltate e le non fatte dei giorni passati.
    cy.visit(`/trips/${trip.id}`);
    cy.get('[data-cy="planner-recover"]').within(() => {
      cy.contains('.recover-item', 'Vaticano').should('contain.text', 'Giorno 2 · saltata');
      cy.contains('.recover-item', 'Colosseo');
      cy.contains('.recover-item', 'Fori Imperiali').contains('button', 'Sposta').click();
    });

    // Scelto un altro giorno, l'orario proposto si può cambiare.
    dayOption(4).click().should('have.attr', 'aria-pressed', 'true');
    panel().find('#move_start').should('have.value', '09:00');
    panel().find('#move_start').clear().type('16:00');
    panel().find('#move_end').clear().type('18:00');
    panel().contains('button', 'Sposta al Giorno 4').click();
    activityOf(trip.id, 'Fori Imperiali', a => expect(a).to.include({ assignedDay: 4, startTime: '16:00', endTime: '18:00' }));
    cy.get('[data-cy="planner-recover"]').should('not.contain.text', 'Fori Imperiali');

    // Un altro membro del gruppo lo vede al caricamento.
    cy.login('sofia');
    at(DAY2, '10:00');
    cy.visit(`/trips/${trip.id}`);
    cy.contains('button', 'Giorno 4').click();
    cy.contains('.timeline-entry', 'Fori Imperiali').find('.timeline-time').should('have.text', '16:00–18:00');
  });

  it('dal pianificatore, prima della partenza: "Sposta" su una tappa e "Rimetti tra le idee"', () => {
    at('2030-08-20', '10:00');
    cy.visit(`/trips/${trip.id}`);
    cy.get('[data-cy="planner-recover"]').should('not.exist');
    cy.contains('.timeline-entry', 'Fori Imperiali').find('button[aria-label="Sposta a un altro giorno: Fori Imperiali"]').click();
    // Prima della partenza ci sono tutti gli altri giorni.
    panel().find('.move-day').should('have.length', 3);
    dayOption(4).should('contain.text', 'Consigliato');
    panel().contains('button', 'Rimetti tra le idee da pianificare').click();
    cy.get('[data-cy="move-undo"]').should('contain.text', '"Fori Imperiali" rimesso tra le idee da pianificare.');
    activityOf(trip.id, 'Fori Imperiali', a => expect(a).to.include({ assignedDay: null, startTime: null }));
  });
});

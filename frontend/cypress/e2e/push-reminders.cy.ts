import { uniq } from '../support/e2e';
import { PushDevice, expectNoPush, rawPushes, receivedPushes, resetPushPreferences, subscribeDevice } from '../support/push';

/**
 * Promemoria push prima della partenza (#99). Il job pianificato è spento nell'ambiente e2e
 * (PUSH_REMINDERS_ENABLED=false): lo si esegue a comando con l'endpoint di test
 * (PUSH_REMINDERS_TEST_ENDPOINT=true), simulando la data di "oggi".
 */

/** Esegue il job dei promemoria come se oggi fosse `today` (yyyy-MM-dd). */
function runReminders(today: string) {
  return cy.api<Record<string, number>>('admin', 'POST', `/api/v1/test/trip-reminders/run?date=${today}`);
}

/** Data ISO `days` giorni dopo `iso`. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Una data di partenza lontana e diversa a ogni esecuzione: nessun altro viaggio parte quel giorno. */
function departure(): string {
  const offset = Math.floor(Math.random() * 3000);
  return addDays('2045-01-01', offset);
}

function notification(device: PushDevice, index = 0) {
  return receivedPushes(device, index + 1).then(list => list[index].payload.notification);
}

describe('Notifiche push – promemoria prima della partenza', () => {
  beforeEach(() => resetPushPreferences('admin', 'sofia', 'marco', 'giulia'));
  after(() => resetPushPreferences('admin', 'sofia', 'marco', 'giulia'));

  it('3 giorni prima e il giorno prima, una sola volta, a tutti i membri; mai per le proposte', () => {
    const name = uniq('E2E Push promemoria');
    const start = departure();
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode);
      cy.createTrip('admin', name, {
        title: uniq('Barcellona'), destination: 'Barcellona', startDate: start, endDate: addDays(start, 3),
      }).then(trip => {
        // Una proposta con la stessa data non riceve promemoria.
        cy.createTrip('admin', name, {
          title: uniq('Proposta'), destination: 'Lisbona', startDate: start, endDate: addDays(start, 2), decision: 'proposal',
        });
        cy.wait(1000);
        subscribeDevice('admin', { prefix: 'rem-admin' }).then(admin => {
          subscribeDevice('sofia', { prefix: 'rem-sofia', lang: 'en' }).then(sofia => {
            // 4 giorni prima: ancora niente.
            runReminders(addDays(start, -4)).should('deep.equal', { three_days: 0, day_before: 0 });
            expectNoPush(admin);

            // 3 giorni prima.
            runReminders(addDays(start, -3)).should('deep.equal', { three_days: 2, day_before: 0 });
            notification(admin).then(n => {
              expect(n.title).to.eq(trip.title);
              expect(n.body).to.eq('Mancano 3 giorni a Barcellona ✈️');
              expect(n.tag).to.eq(`reminder:${trip.id}`);
              expect(n.data.url).to.eq(`/trips/${trip.id}`);
              expect(n.data.onActionClick.default).to.deep.equal({ operation: 'navigateLastFocusedOrOpen', url: `/trips/${trip.id}` });
            });
            notification(sofia).its('body').should('eq', '3 days to go until Barcellona ✈️');

            // Lo stesso giorno il job gira più volte (e dopo un riavvio): nessun doppione.
            runReminders(addDays(start, -3)).should('deep.equal', { three_days: 0, day_before: 0 });
            runReminders(addDays(start, -2)).should('deep.equal', { three_days: 0, day_before: 0 });

            // Il giorno prima.
            runReminders(addDays(start, -1)).should('deep.equal', { three_days: 0, day_before: 2 });
            notification(admin, 1).then(n => {
              expect(n.body).to.eq('Domani si parte per Barcellona!');
              expect(n.tag).to.eq(`reminder:${trip.id}`);
            });
            notification(sofia, 1).its('body').should('eq', 'Tomorrow you leave for Barcellona!');
            runReminders(addDays(start, -1)).should('deep.equal', { three_days: 0, day_before: 0 });

            // Il giorno della partenza e dopo: niente.
            runReminders(start).should('deep.equal', { three_days: 0, day_before: 0 });
            cy.wait(1000);
            rawPushes(admin).should('have.length', 2);
            rawPushes(sofia).should('have.length', 2);
          });
        });
      });
    });
  });

  it('se la data del viaggio cambia, i promemoria seguono la nuova data', () => {
    const name = uniq('E2E Push promemoria data');
    const start = departure();
    const moved = addDays(start, 20);
    cy.createGroup('admin', name).then(() => {
      cy.createTrip('admin', name, {
        title: uniq('Lisbona'), destination: 'Lisbona', startDate: start, endDate: addDays(start, 2),
      }).then(trip => {
        subscribeDevice('admin', { prefix: 'rem-moved' }).then(admin => {
          runReminders(addDays(start, -3)).its('three_days').should('eq', 1);
          notification(admin).its('body').should('eq', 'Mancano 3 giorni a Lisbona ✈️');

          // Viaggio spostato: alla vecchia data non arriva più nulla, alla nuova sì.
          cy.api('admin', 'PUT', `/api/v1/trips/${trip.id}`, { startDate: moved, endDate: addDays(moved, 2) });
          runReminders(addDays(start, -1)).should('deep.equal', { three_days: 0, day_before: 0 });
          runReminders(addDays(moved, -3)).its('three_days').should('eq', 1);
          notification(admin, 1).its('body').should('eq', 'Mancano 3 giorni a Lisbona ✈️');
          runReminders(addDays(moved, -1)).its('day_before').should('eq', 1);
          notification(admin, 2).its('body').should('eq', 'Domani si parte per Lisbona!');
        });
      });
    });
  });

  it('rispetta la preferenza "Promemoria" e i gruppi silenziati', () => {
    const name = uniq('E2E Push promemoria filtri');
    const start = departure();
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('marco', group.inviteCode);
      cy.joinGroup('giulia', group.inviteCode);
      cy.api('marco', 'PUT', '/api/v1/push/preferences', { reminders: false });
      cy.api('giulia', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true });
      cy.createTrip('admin', name, {
        title: uniq('Napoli'), destination: 'Napoli', startDate: start, endDate: addDays(start, 2),
      }).then(trip => {
        subscribeDevice('admin', { prefix: 'rem-on' }).then(admin => {
          subscribeDevice('marco', { prefix: 'rem-pref-off' }).then(marco => {
            subscribeDevice('giulia', { prefix: 'rem-muted' }).then(giulia => {
              runReminders(addDays(start, -1));
              notification(admin).its('tag').should('eq', `reminder:${trip.id}`);
              expectNoPush(marco);
              rawPushes(giulia).should('have.length', 0);
            });
          });
        });
      });
    });
  });

  it('l\'endpoint di test rifiuta una data non valida', () => {
    cy.apiToken('admin').then(token =>
      cy.request({
        method: 'POST', url: '/api/v1/test/trip-reminders/run?date=domani', failOnStatusCode: false,
        headers: { Authorization: `Bearer ${token}` },
      }).its('status').should('eq', 400),
    );
  });
});

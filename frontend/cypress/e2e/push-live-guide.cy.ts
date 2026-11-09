import { uniq } from '../support/e2e';
import { PushDevice, expectNoPush, rawPushes, receivedPushes, resetPushPreferences, subscribeDevice } from '../support/push';

/**
 * #110 Notifiche push della guida durante il viaggio: buongiorno, pasti, chiusure imminenti e fine giornata.
 * Il job pianificato è spento nell'ambiente e2e (PUSH_LIVE_GUIDE_ENABLED=false): lo si esegue a comando con
 * l'endpoint di test (PUSH_LIVE_GUIDE_TEST_ENDPOINT=true) simulando l'ora italiana. Push service finto (api-stubs).
 *
 * Giorno 1: Museo 10:00–12:00 (aperto 9:00-13:00 → avviso alle 12:00), pranzo da Bar Cañete (orario indicativo
 * 12:30), Parco 15:00–17:00. Giorno 2: Mole 10:00. Buongiorno alle 8:30, fine giornata alle 21:30.
 */

type Counts = { morning: number; meal: number; closing: number; evening: number };
const NONE: Counts = { morning: 0, meal: 0, closing: 0, evening: 0 };

/** Esegue il job come se fosse `at` (yyyy-MM-ddTHH:mm, ora italiana). */
function runAt(at: string) {
  return cy.api<Counts>('admin', 'POST', `/api/v1/test/live-guide/run?at=${at}`);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Date lontane e diverse a ogni esecuzione: nessun altro viaggio è in corso quel giorno. */
function tripStart(): string {
  return addDays('2050-01-01', Math.floor(Math.random() * 3000));
}

function notification(device: PushDevice, index = 0) {
  return receivedPushes(device, index + 1).then(list => list[index].payload.notification);
}

interface LiveTrip { id: string; title: string; groupId: string; museoId: string }

function createLiveTrip(groupName: string, start: string): Cypress.Chainable<LiveTrip> {
  const title = uniq('E2E Push guida');
  return cy.createTrip('admin', groupName, {
    title, destination: 'Torino', startDate: start, endDate: addDays(start, 1),
  }).then(trip => {
    const base = `/api/v1/trips/${trip.id}`;
    const activity = (name: string, extra: Record<string, unknown>) => cy.api('admin', 'POST', `${base}/activities`, {
      name, category: 'monument', address: 'Torino', ticketsRequired: false, bookingRequired: false, ...extra,
    });
    activity('Parco', { assignedDay: 1, startTime: '15:00', endTime: '17:00' });
    activity('Mole', { assignedDay: 2, startTime: '10:00', endTime: '12:00' });
    cy.api('admin', 'POST', `${base}/places-to-eat`, {
      name: 'Bar Cañete', category: 'lunch', priceRange: '€€', address: 'Torino', bookingRequired: false,
      assignedDay: 1, assignedMeal: 'lunch',
    });
    return activity('Museo', { assignedDay: 1, startTime: '10:00', endTime: '12:00', category: 'museum', openingHours: '9:00-13:00' })
      .then(museo => cy.wrap({ id: trip.id as string, title, groupId: trip.groupId as string, museoId: museo.id as string }));
  });
}

describe('Notifiche push – guida durante il viaggio', () => {
  beforeEach(() => resetPushPreferences('admin', 'sofia', 'marco', 'giulia'));
  after(() => resetPushPreferences('admin', 'sofia', 'marco', 'giulia'));

  it('buongiorno, chiusura, pasto e fine giornata agli orari giusti, una sola volta, con la guida come pagina', () => {
    const name = uniq('E2E Push guida');
    const start = tripStart();
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode);
      createLiveTrip(name, start).then(trip => {
        subscribeDevice('admin', { prefix: 'live-admin' }).then(admin => {
          subscribeDevice('sofia', { prefix: 'live-sofia', lang: 'en' }).then(sofia => {
            const url = `/trips/${trip.id}/live`;

            // Prima delle 8:30 e il giorno prima del viaggio: niente.
            runAt(`${addDays(start, -1)}T21:35`).should('deep.equal', NONE);
            runAt(`${start}T08:00`).should('deep.equal', NONE);
            expectNoPush(admin);

            // Buongiorno con il programma del giorno.
            runAt(`${start}T08:35`).should('deep.equal', { ...NONE, morning: 2 });
            notification(admin).then(n => {
              expect(n.title).to.eq(trip.title);
              expect(n.body).to.eq('Buongiorno! Oggi: Museo, pranzo da Bar Cañete e Parco');
              expect(n.tag).to.eq(`live:${trip.id}:morning`);
              expect(n.data.url).to.eq(url);
              expect(n.data.onActionClick.default).to.deep.equal({ operation: 'navigateLastFocusedOrOpen', url });
            });
            notification(sofia).its('body').should('eq', 'Good morning! Today: Museo, lunch at Bar Cañete and Parco');
            // Il job gira ogni 5 minuti: nessun doppione.
            runAt(`${start}T08:40`).should('deep.equal', NONE);

            // 1 ora prima della chiusura del museo (13:00).
            runAt(`${start}T12:05`).should('deep.equal', { ...NONE, closing: 2 });
            notification(admin, 1).then(n => {
              expect(n.body).to.eq('Museo chiude tra 1 ora (alle 13:00)');
              expect(n.data.url).to.eq(url);
            });
            notification(sofia, 1).its('body').should('eq', 'Museo closes in 1 hour (at 13:00)');

            // Pranzo all'orario programmato.
            runAt(`${start}T12:30`).should('deep.equal', { ...NONE, meal: 2 });
            notification(admin, 2).its('body').should('eq', 'È ora di pranzo: Bar Cañete ti aspetta');
            notification(sofia, 2).its('body').should('eq', 'It\'s lunch time: Bar Cañete is waiting for you');
            runAt(`${start}T12:35`).should('deep.equal', NONE);

            // Fine giornata con riepilogo e anteprima di domani (il museo è stato segnato come fatto).
            cy.api('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
              const museo = t.activities.find((a: { id: string }) => a.id === trip.museoId);
              cy.api('admin', 'PUT', `/api/v1/trips/${trip.id}/activities/${museo.id}`, { ...museo, isCompleted: true });
            });
            runAt(`${start}T21:30`).should('deep.equal', { ...NONE, evening: 2 });
            notification(admin, 3).its('body').should('eq', 'Giornata finita: 1 tappa fatta su 3. Domani: Mole');
            notification(sofia, 3).its('body').should('eq', 'Day over: 1 of 3 stops done. Tomorrow: Mole');
            runAt(`${start}T21:45`).should('deep.equal', NONE);

            // Ultimo giorno: niente buongiorno dopo l'orario utile (oltre 60 minuti), fine viaggio la sera.
            runAt(`${addDays(start, 1)}T10:00`).should('deep.equal', NONE);
            runAt(`${addDays(start, 1)}T21:31`).its('evening').should('eq', 2);
            notification(admin, 4).its('body').should('eq', 'Giornata finita: 0 tappe fatte su 1. Era l\'ultimo giorno: buon rientro!');
            cy.wait(1000);
            rawPushes(admin).should('have.length', 5);
          });
        });
      });
    });
  });

  it('tappa già fatta: niente avviso di chiusura né di pasto', () => {
    const name = uniq('E2E Push guida fatte');
    const start = tripStart();
    cy.createGroup('admin', name).then(() => {
      createLiveTrip(name, start).then(trip => {
        cy.api('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
          const museo = t.activities.find((a: { id: string }) => a.id === trip.museoId);
          cy.api('admin', 'PUT', `/api/v1/trips/${trip.id}/activities/${museo.id}`, { ...museo, isCompleted: true });
          const bar = t.placesToEat.find((p: { name: string }) => p.name === 'Bar Cañete');
          cy.api('admin', 'PUT', `/api/v1/trips/${trip.id}/places-to-eat/${bar.id}`, { ...bar, isSkipped: true });
        });
        subscribeDevice('admin', { prefix: 'live-done' }).then(admin => {
          runAt(`${start}T12:05`).should('deep.equal', NONE);
          runAt(`${start}T12:30`).should('deep.equal', NONE);
          expectNoPush(admin);
        });
      });
    });
  });

  it('rispetta la preferenza "Guida durante il viaggio" e i gruppi silenziati', () => {
    const name = uniq('E2E Push guida filtri');
    const start = tripStart();
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('marco', group.inviteCode);
      cy.joinGroup('giulia', group.inviteCode);
      cy.api('marco', 'PUT', '/api/v1/push/preferences', { liveGuide: false }).its('liveGuide').should('eq', false);
      cy.api('giulia', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true });
      createLiveTrip(name, start).then(trip => {
        subscribeDevice('admin', { prefix: 'live-on' }).then(admin => {
          subscribeDevice('marco', { prefix: 'live-pref-off' }).then(marco => {
            subscribeDevice('giulia', { prefix: 'live-muted' }).then(giulia => {
              runAt(`${start}T08:30`);
              notification(admin).its('tag').should('eq', `live:${trip.id}:morning`);
              expectNoPush(marco);
              rawPushes(giulia).should('have.length', 0);
            });
          });
        });
      });
    });
  });

  it('l\'endpoint di test rifiuta un orario non valido', () => {
    cy.apiToken('admin').then(token =>
      cy.request({
        method: 'POST', url: '/api/v1/test/live-guide/run?at=domani', failOnStatusCode: false,
        headers: { Authorization: `Bearer ${token}` },
      }).its('status').should('eq', 400),
    );
  });
});

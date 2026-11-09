import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #109 Guida della giornata offline.
 * Il service worker non è attivo con `ng serve`: l'app funziona offline con i dati salvati sul dispositivo e la coda
 * delle modifiche (OfflineQueueService), che è ciò che si verifica qui. La rete si simula così:
 *  - richieste al backend con `forceNetworkError` (come il telefono senza rete, o in metro);
 *  - `navigator.onLine` falso e evento `offline`/`online` del browser.
 * Le funzioni della coda (unione delle azioni, conflitti) hanno i test unitari in
 * src/app/core/utils/offline-queue.utils.spec.ts.
 *
 * Viaggio a Torino, 10–12 settembre 2030: il giorno 2 Duomo 09:00–11:00 e Museo Egizio 15:00–17:00.
 */

const DAY2 = '2030-09-11';

interface OfflineTrip { id: string; title: string }

/** Rete simulata: true = backend irraggiungibile. */
let offline = false;

function activity(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'monument', address: 'Torino', ticketsRequired: false, bookingRequired: false, ...extra };
}

function createTrip(): Cypress.Chainable<OfflineTrip> {
  const title = uniq('E2E Offline');
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Torino', startDate: '2030-09-10', endDate: '2030-09-12' })
    .then(trip => {
      const base = `/api/v1/trips/${trip.id}`;
      cy.api('admin', 'POST', `${base}/activities`, activity('Duomo', { assignedDay: 2, startTime: '09:00', endTime: '11:00' }));
      cy.api('admin', 'POST', `${base}/activities`, activity('Museo Egizio', { assignedDay: 2, startTime: '15:00', endTime: '17:00', category: 'museum' }));
      return cy.wrap({ id: trip.id as string, title });
    });
}

/** Intercetta tutte le chiamate al backend: con `offline` vero falliscono come senza rete. */
function simulateNetwork() {
  offline = false;
  const handler = (req: { reply: (r: { forceNetworkError: boolean }) => void }) => {
    if (offline) req.reply({ forceNetworkError: true });
  };
  cy.intercept('/api/**', handler);
  cy.intercept('/auth/**', handler);
}

/** `navigator.onLine` segue la rete simulata. */
function stubOnLine(win: Window) {
  Object.defineProperty(win.navigator, 'onLine', { configurable: true, get: () => !offline });
}

function setClock(localDateTime: string) {
  const [date, time] = localDateTime.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
}

function openGuide(trip: OfflineTrip) {
  cy.visit(`/trips/${trip.id}/live`, { onBeforeLoad: stubOnLine });
  cy.contains('.live-trip-title', trip.title).should('be.visible');
}

/** Il telefono va offline (o torna online) con la pagina aperta. */
function goOffline() {
  cy.then(() => (offline = true));
  cy.window().then(win => win.dispatchEvent(new Event('offline')));
}

function goOnline() {
  cy.then(() => (offline = false));
  cy.window().then(win => win.dispatchEvent(new Event('online')));
}

const nowCard = () => cy.get('[data-cy="live-now"]');
const dayItem = (name: string) => cy.contains('.live-timeline-item', name);

describe('In viaggio – guida offline', () => {
  beforeEach(() => {
    cy.login('admin');
    simulateNetwork();
    setClock(`${DAY2}T10:30`);
  });

  it('offline la guida si apre con i dati salvati e Fatto viene sincronizzato al ritorno online', () => {
    createTrip().then(trip => {
      // Online: la guida scarica e salva i dati del viaggio.
      openGuide(trip);
      nowCard().find('.live-now-name').should('have.text', 'Duomo');
      cy.get('[data-cy="offline-banner"]').should('not.exist');

      // Offline: riaprendo l'app la guida mostra i dati salvati.
      goOffline();
      openGuide(trip);
      cy.get('[data-cy="offline-message"]').invoke('text')
        .should('match', /Sei offline: stai vedendo i dati salvati alle \d{2}:\d{2}/);
      nowCard().find('.live-now-name').should('have.text', 'Duomo');
      dayItem('Museo Egizio').should('be.visible');

      // Fatto offline: subito in locale, in coda per il server.
      nowCard().contains('button', 'Fatto').click();
      cy.toast(/Sei offline: salvato sul telefono/).should('be.visible');
      dayItem('Duomo').should('have.attr', 'data-status', 'done');
      cy.get('[data-cy="offline-pending"]').should('contain.text', '1 modifica in attesa di sincronizzazione');

      // La modifica resta sul telefono anche chiudendo e riaprendo l'app.
      openGuide(trip);
      dayItem('Duomo').should('have.attr', 'data-status', 'done');
      cy.get('[data-cy="offline-pending"]').should('contain.text', '1 modifica in attesa');

      // Sul server non è ancora arrivata (cy.request non passa dalle intercettazioni).
      cy.api('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
        expect(t.activities.find((a: { name: string }) => a.name === 'Duomo').isCompleted).to.eq(false);
      });

      // Di nuovo online: la coda viene inviata.
      goOnline();
      cy.toast('Modifiche fatte offline sincronizzate').should('be.visible');
      cy.get('[data-cy="offline-banner"]').should('not.exist');
      cy.apiUntil<any>('admin', `/api/v1/trips/${trip.id}`, t =>
        expect(t.activities.find((a: { name: string }) => a.name === 'Duomo').isCompleted).to.eq(true));
      dayItem('Duomo').should('have.attr', 'data-status', 'done');
    });
  });

  it('rete che non risponde (telefono "connesso" in metro): Salta va in coda e parte quando la rete torna', () => {
    createTrip().then(trip => {
      openGuide(trip);
      nowCard().find('.live-now-name').should('have.text', 'Duomo');

      // navigator.onLine resta vero: è l'errore di rete della richiesta a far scattare la coda.
      cy.then(() => (offline = true));
      cy.window().then(win => Object.defineProperty(win.navigator, 'onLine', { configurable: true, get: () => true }));
      nowCard().contains('button', 'Salta').click();
      cy.get('[data-cy="offline-pending"]').should('contain.text', '1 modifica in attesa');
      cy.get('[data-cy="offline-message"]').should('contain.text', 'Sei offline');
      dayItem('Duomo').should('have.attr', 'data-status', 'skipped');

      goOnline();
      cy.apiUntil<any>('admin', `/api/v1/trips/${trip.id}`, t =>
        expect(t.activities.find((a: { name: string }) => a.name === 'Duomo').isSkipped).to.eq(true));
      cy.get('[data-cy="offline-banner"]').should('not.exist');
    });
  });

  it('conflitto: il server rifiuta la modifica (tappa eliminata da un altro membro) → avviso e vale il server', () => {
    createTrip().then(trip => {
      openGuide(trip);
      nowCard().find('.live-now-name').should('have.text', 'Duomo');

      goOffline();
      nowCard().contains('button', 'Fatto').click();
      cy.get('[data-cy="offline-pending"]').should('contain.text', '1 modifica in attesa');

      // Intanto un altro membro elimina la tappa (cy.request non passa dalle intercettazioni).
      cy.api('admin', 'GET', `/api/v1/trips/${trip.id}`).then(t => {
        const duomo = t.activities.find((a: { name: string }) => a.name === 'Duomo');
        cy.api('sofia', 'DELETE', `/api/v1/trips/${trip.id}/activities/${duomo.id}`);
      });

      goOnline();
      cy.toast(/non è stata accettata dal server \("Duomo"\)/).should('be.visible');
      cy.get('[data-cy="offline-banner"]').should('not.exist');
      dayItem('Duomo').should('not.exist');
      nowCard().find('.live-now-name').should('have.text', 'Museo Egizio');
    });
  });

  it('spesa aggiunta offline nel pianificatore: visibile subito e salvata al ritorno online', () => {
    createTrip().then(trip => {
      cy.visit(`/trips/${trip.id}`, { onBeforeLoad: stubOnLine });
      cy.contains('.trip-tab-btn', 'Spese').click();
      cy.contains('Nessuna spesa registrata').should('be.visible');

      goOffline();
      cy.contains('button', 'Aggiungi spesa').first().click();
      cy.dialog('Aggiungi spesa').within(() => {
        cy.get('#exp_title').type('Gelato offline');
        cy.get('#exp_amount').type('12');
        cy.contains('button', 'Aggiungi spesa').click();
      });
      cy.toast(/Sei offline: salvato sul telefono/).should('be.visible');
      cy.contains('.exp-item-title', 'Gelato offline').should('be.visible');
      cy.get('[data-cy="offline-pending"]').should('contain.text', '1 modifica in attesa');

      // Modificata ancora offline: al server arriva una sola creazione con l'ultimo importo.
      cy.get('button[aria-label="Modifica spesa"]').click();
      cy.dialog('Modifica spesa').within(() => {
        cy.get('#exp_amount').clear().type('15');
        cy.contains('button', 'Salva modifiche').click();
      });
      cy.get('[data-cy="offline-pending"]').should('contain.text', '1 modifica in attesa');

      goOnline();
      cy.apiUntil<any[]>('admin', `/api/v1/trips/${trip.id}/expenses`, e => {
        expect(e).to.have.length(1);
        expect(e[0]).to.include({ title: 'Gelato offline', amount: 15 });
      });
      cy.get('[data-cy="offline-banner"]').should('not.exist');
      cy.contains('.exp-item-title', 'Gelato offline').should('have.length', 1);
    });
  });
});

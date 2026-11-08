import { uniq } from '../support/e2e';

/**
 * #104 Il viaggio in corso diventa la homepage: all'apertura dell'app (rotta '') e dopo l'accesso si apre la
 * guida della giornata (/trips/:id/live) se l'utente ha un viaggio confermato in corso oggi; voce "Oggi" nella
 * barra in basso solo durante il viaggio; riepilogo "Com'è andato il viaggio" dopo la fine.
 *
 * Ogni test usa un utente nuovo con un gruppo suo: così i viaggi degli altri spec (o di run precedenti) non
 * cambiano quale viaggio è "in corso". La data è simulata con cy.clock (solo `Date`).
 * Viaggi di prova: 10–12 marzo 2031.
 */

type Credentials = { email: string; password: string };

const START = '2031-03-10';
const END = '2031-03-12';
const DURING = new Date(2031, 2, 11, 10, 0);
const AFTER = new Date(2031, 2, 14, 10, 0);
const BEFORE = new Date(2031, 2, 1, 10, 0);

const bottomNav = () => cy.get('nav[aria-label="Navigazione"]');

/** Nuovo utente con un gruppo suo. */
function freshUser(): Cypress.Chainable<{ user: Credentials; group: string }> {
  const email = `e2e.home.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const user = { email, password: 'Segreta123!' };
  const group = uniq('E2E Casa');
  cy.request('POST', '/auth/register', {
    firstName: 'Viaggiatore', lastName: 'Casa', birthDate: '1990-01-01', email, password: user.password, avatar: '🎒', color: '#10b981'
  });
  cy.createGroup(user, group);
  return cy.wrap({ user, group });
}

function createTrip(user: Credentials, group: string, title: string, extra: Record<string, unknown> = {}): Cypress.Chainable<{ id: string }> {
  return cy.createTrip(user, group, { title, startDate: START, endDate: END, ...extra }).then((trip: { id: string }) => {
    cy.api(user, 'POST', `/api/v1/trips/${trip.id}/activities`, {
      name: 'Colosseo', category: 'monument', address: 'Roma', ticketsRequired: false, bookingRequired: false,
      assignedDay: 2, startTime: '09:00', endTime: '11:00'
    });
    return cy.wrap({ id: trip.id });
  });
}

describe('In viaggio – homepage durante il viaggio', () => {
  let user: Credentials;
  let group: string;

  beforeEach(() => {
    freshUser().then(u => {
      user = u.user;
      group = u.group;
    });
  });

  it('con un viaggio in corso l\'app si apre sulla guida della giornata; si può tornare al pianificatore', () => {
    const title = uniq('E2E Roma');
    createTrip(user, group, title).then(trip => {
      cy.login(user);
      cy.clock(DURING, ['Date']);
      cy.visit('/');
      cy.location('pathname').should('eq', `/trips/${trip.id}/live`);
      cy.contains('h1', 'Giorno 2 di 3').should('be.visible');
      cy.get('[data-cy="live-now"]').should('contain.text', 'Colosseo');

      // La scelta non viene forzata alle navigazioni successive.
      cy.contains('a', 'Vai al pianificatore').click();
      cy.location('pathname').should('eq', `/trips/${trip.id}`);
      cy.get('header nav').contains('a', 'Viaggi').click();
      cy.location('pathname').should('eq', '/trips');
      cy.get('header nav').contains('a', 'Gruppi').click();
      cy.location('pathname').should('eq', '/groups');
    });
  });

  it('senza viaggi confermati in corso la home resta la lista dei viaggi (anche con una proposta in corso)', () => {
    createTrip(user, group, uniq('E2E Proposta'), { decision: 'proposal' });
    createTrip(user, group, uniq('E2E Futuro'), { startDate: '2031-05-01', endDate: '2031-05-03' });
    cy.login(user);
    cy.clock(DURING, ['Date']);
    cy.visit('/');
    cy.location('pathname').should('eq', '/trips');
    cy.get('header nav').contains('a', 'Oggi').should('not.exist');
  });

  it('prima e dopo il viaggio la home è la lista dei viaggi', () => {
    createTrip(user, group, uniq('E2E Roma'));
    cy.login(user);
    cy.clock(BEFORE, ['Date']);
    cy.visit('/');
    cy.location('pathname').should('eq', '/trips');
  });

  it('voce "Oggi" nella barra in basso solo durante il viaggio, con le voci uguali e i margini', () => {
    cy.viewport('iphone-x');
    const title = uniq('E2E Roma');
    createTrip(user, group, title).then(trip => {
      cy.login(user);
      cy.clock(DURING, ['Date']);
      cy.visit('/trips');
      bottomNav().contains('a.wb-nav-item', 'Oggi').should('be.visible')
        .and('have.attr', 'href', `/trips/${trip.id}/live`);

      bottomNav().then($nav => {
        const nav = $nav[0].getBoundingClientRect();
        const items = Array.from($nav[0].querySelectorAll('.wb-nav-item')).map(i => i.getBoundingClientRect());
        expect(items).to.have.length(5); // Esplora, Oggi, Viaggi, Gruppi, Profilo (più il pulsante +, largo uguale)
        items.forEach(r => expect(r.width).to.be.closeTo(items[0].width, 1));
        expect(items[0].left - nav.left).to.be.gte(10);
        expect(nav.right - items[items.length - 1].right).to.be.gte(10);
      });

      bottomNav().contains('a.wb-nav-item', 'Oggi').click();
      cy.location('pathname').should('eq', `/trips/${trip.id}/live`);
      bottomNav().contains('a.wb-nav-item', 'Oggi').should('have.class', 'active-nav');
      bottomNav().contains('a.wb-nav-item', 'Viaggi').should('not.have.class', 'active-nav');
    });
  });

  it('fuori dal viaggio la barra in basso non ha la voce "Oggi"', () => {
    cy.viewport('iphone-x');
    createTrip(user, group, uniq('E2E Roma'));
    cy.login(user);
    cy.clock(AFTER, ['Date']);
    cy.visit('/trips');
    bottomNav().contains('a.wb-nav-item', 'Viaggi').should('be.visible');
    bottomNav().contains('.wb-nav-item', 'Oggi').should('not.exist');
  });

  it('più viaggi in corso: si apre l\'ultimo usato, con il selettore in alto', () => {
    const titleA = uniq('E2E Alfa');
    const titleB = uniq('E2E Beta');
    createTrip(user, group, titleA).then(a => {
      createTrip(user, group, titleB).then(b => {
        cy.login(user);
        cy.clock(DURING, ['Date']);
        cy.visit(`/trips/${b.id}/live`);
        cy.contains('.live-trip-title', titleB).should('be.visible');

        cy.visit('/');
        cy.location('pathname').should('eq', `/trips/${b.id}/live`);
        cy.get('nav[aria-label="Viaggi in corso"]').within(() => {
          cy.contains('a', titleB).should('have.attr', 'aria-current', 'page');
          cy.contains('a', titleA).click();
        });
        cy.location('pathname').should('eq', `/trips/${a.id}/live`);
        cy.contains('.live-trip-title', titleA).should('be.visible');

        cy.visit('/');
        cy.location('pathname').should('eq', `/trips/${a.id}/live`);
      });
    });
  });

  it('dopo l\'accesso dalla modale, con un viaggio in corso si apre la guida', () => {
    createTrip(user, group, uniq('E2E Roma')).then(trip => {
      cy.clock(DURING, ['Date']);
      cy.visit('/explore');
      cy.get('header button[aria-label="Accedi o registrati"]').click();
      cy.dialog('Accedi o registrati').within(() => {
        cy.get('#auth-login-email').type(user.email);
        cy.get('#auth-login-password').type(user.password, { log: false });
        cy.contains('button[type="submit"]', 'Continua').click();
      });
      cy.location('pathname').should('eq', `/trips/${trip.id}/live`);
    });
  });

  it('dopo la fine: la home torna la lista dei viaggi con il riepilogo, una volta sola', () => {
    const title = uniq('E2E Roma');
    createTrip(user, group, title).then(trip => {
      cy.api<any>(user, 'POST', `/api/v1/trips/${trip.id}/activities`, {
        name: 'Pantheon', category: 'monument', address: 'Roma', ticketsRequired: false, bookingRequired: false,
        assignedDay: 1, isCompleted: true
      });
      cy.me(user).then(me => {
        cy.api(user, 'POST', `/api/v1/trips/${trip.id}/expenses`, {
          title: 'Cena', amount: 40, category: 'food', date: START, paidBy: me.id, splitAmong: [me.id], shares: { [me.id]: 40 }
        });
        cy.api(user, 'POST', `/api/v1/trips/${trip.id}/expenses`, {
          title: 'Pagamento', amount: 15, category: 'other', date: START, paidBy: me.id, splitAmong: [me.id], shares: { [me.id]: 15 },
          type: 'settlement'
        });
      });

      cy.login(user);
      cy.clock(AFTER, ['Date']);
      cy.visit('/');
      cy.location('pathname').should('eq', '/trips');
      cy.get('[data-cy="trip-recap"]').within(() => {
        cy.contains('Com\'è andato il viaggio?');
        cy.contains('h2', title);
        cy.contains('.recap-stat', 'Tappe fatte').should('contain.text', '1 di 2');
        // Solo le spese vere: il pagamento tra membri non conta.
        cy.contains('.recap-stat', 'Spese totali').should('contain.text', '40').and('not.contain.text', '55');
        cy.get('button[aria-label="Chiudi il riepilogo"]').click();
      });
      cy.get('[data-cy="trip-recap"]').should('not.exist');

      cy.reload();
      cy.contains('h1', 'Viaggi').should('be.visible');
      cy.get('[data-cy="trip-recap"]').should('not.exist');
    });
  });
});

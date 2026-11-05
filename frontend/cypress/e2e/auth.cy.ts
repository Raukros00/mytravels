import { uniq } from '../support/e2e';
import { USERS } from '../support/users';

const authModal = () => cy.dialog('Accedi o registrati');

function fillLogin(email: string, password: string) {
  authModal().within(() => {
    cy.get('#auth-login-email').type(email);
    cy.get('#auth-login-password').type(password, { log: false });
    cy.contains('button[type="submit"]', 'Continua').click();
  });
}

describe('Autenticazione (modale)', () => {
  describe('visitatore', () => {
    it('vede Esplora come home, senza modale', () => {
      cy.visit('/');
      cy.location('pathname').should('eq', '/explore');
      cy.contains('h1', 'Esplora').should('be.visible');
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('la navbar mostra solo Esplora, Accedi e Registrati', () => {
      cy.visit('/explore');
      cy.get('header nav').within(() => {
        cy.contains('a', 'Esplora').should('be.visible');
        cy.contains('a', 'Viaggi').should('not.exist');
        cy.contains('a', 'Gruppi').should('not.exist');
      });
      cy.get('header').contains('button', 'Accedi').should('be.visible');
      cy.get('header').contains('button', 'Registrati').should('be.visible');
      cy.get('button[title="Notifiche"]').should('not.exist');
    });

    it('una pagina protetta apre la modale sopra Esplora e dopo il login porta alla pagina', () => {
      cy.visit('/groups');
      cy.location('pathname').should('eq', '/explore');
      authModal().should('be.visible');
      cy.get('#auth-tab-login').should('have.attr', 'aria-selected', 'true');

      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('pathname').should('eq', '/groups');
      cy.toast(`Bentornato, ${USERS.admin.name}!`).should('be.visible');
    });

    it('chiudendo la modale resta su Esplora', () => {
      cy.visit('/trips');
      authModal().find('button[aria-label="Chiudi modale"]').click();
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('pathname').should('eq', '/explore');
      cy.visit('/profile');
      cy.location('pathname').should('eq', '/explore');
    });

    it('i vecchi link /login e /register aprono la modale sulla scheda giusta', () => {
      cy.visit('/register');
      cy.location('pathname').should('eq', '/explore');
      cy.get('#auth-tab-register').should('have.attr', 'aria-selected', 'true');

      cy.visit('/login?returnUrl=%2Fprofile');
      cy.get('#auth-tab-login').should('have.attr', 'aria-selected', 'true');
      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.location('pathname').should('eq', '/profile');
    });

    it('un returnUrl verso un altro sito viene ignorato', () => {
      cy.visit('/login?returnUrl=%2F%2Fevil.example.com');
      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('host').should('eq', new URL(Cypress.config('baseUrl')!).host);
      cy.location('pathname').should('eq', '/explore');
    });

    it('un utente in cache senza token non è considerato loggato (residuo modalità mock)', () => {
      cy.visit('/explore', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_seed_version', JSON.stringify('10'));
          win.localStorage.setItem(
            'wb_current_user',
            JSON.stringify({ id: 'usr_demo_1', name: 'Alessandro Dominici', email: 'alessandro@example.com' }),
          );
          win.localStorage.setItem('wb_groups', JSON.stringify([{ id: 'grp_1', name: 'Weekend Foodies', members: [] }]));
        },
      });
      cy.get('header').contains('button', 'Accedi').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_current_user').should('be.null');
      cy.window().its('localStorage').invoke('getItem', 'wb_groups').should('be.null');
    });
  });

  describe('accedi', () => {
    beforeEach(() => {
      cy.visit('/explore');
      cy.get('header').contains('button', 'Accedi').click();
      authModal().should('be.visible');
    });

    it('il form parte vuoto e "Continua" è disabilitato', () => {
      authModal().within(() => {
        cy.get('#auth-login-email').should('have.value', '');
        cy.get('#auth-login-password').should('have.value', '');
        cy.contains('button', 'Continua').should('be.disabled');
      });
    });

    it('valida il formato dell\'email', () => {
      authModal().within(() => {
        cy.get('#auth-login-email').type('non-una-email').blur();
        cy.contains('.form-error', 'Inserisci un indirizzo email valido.').should('be.visible');
        cy.get('#auth-login-password').type('qualcosa');
        cy.contains('button', 'Continua').should('be.disabled');
      });
    });

    it('con credenziali corrette chiude la modale e resta sulla pagina', () => {
      cy.intercept('POST', '/auth/login').as('login');
      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.wait('@login').its('response.statusCode').should('eq', 200);
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('pathname').should('eq', '/explore');
      cy.toast(`Bentornato, ${USERS.admin.name}!`).should('be.visible');
      cy.get('header nav').contains('a', 'Viaggi').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.a', 'string');
    });

    it('con password errata mostra l\'errore nella modale', () => {
      fillLogin(USERS.admin.email, 'password-sbagliata');
      authModal().find('.auth-error').should('contain.text', 'Email o password non corretti.');
      authModal().should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.null');
    });

    it('passa alla scheda Registrati e l\'errore precedente sparisce', () => {
      fillLogin(USERS.admin.email, 'password-sbagliata');
      authModal().find('.auth-error').should('be.visible');
      authModal().contains('.auth-switch button', 'Registrati').click();
      cy.get('#auth-tab-register').should('have.attr', 'aria-selected', 'true');
      authModal().find('.auth-error').should('not.exist');
    });

    it('riaprendo la modale i campi sono di nuovo vuoti', () => {
      authModal().find('#auth-login-email').type('qualcuno@example.com');
      authModal().find('button[aria-label="Chiudi modale"]').click();
      cy.get('header').contains('button', 'Accedi').click();
      authModal().find('#auth-login-email').should('have.value', '');
    });
  });

  describe('registrati', () => {
    beforeEach(() => {
      cy.visit('/explore');
      cy.get('header').contains('button', 'Registrati').click();
      cy.get('#auth-tab-register').should('have.attr', 'aria-selected', 'true');
    });

    it('crea un nuovo account ed entra', () => {
      const name = uniq('Tester');
      const email = `e2e.${Date.now()}@example.com`;

      authModal().within(() => {
        cy.contains('button', 'Crea account').should('be.disabled');
        cy.get('#auth-register-name').type(name);
        cy.get('#auth-register-email').type(email);
        cy.get('#auth-register-password').type('Segreta123!');
        cy.get('.avatar-select-btn').eq(2).click().should('have.class', 'selected');
        cy.get('.color-btn').eq(1).click().should('have.class', 'selected');
        cy.contains('button', 'Crea account').click();
      });

      cy.get('[role="dialog"]').should('not.exist');
      cy.toast(`Benvenuto su WanderBite, ${name}!`).should('be.visible');

      // Un utente nuovo non vede gruppi né viaggi di altri.
      cy.get('header nav').contains('a', 'Viaggi').click();
      cy.contains('Nessun viaggio ancora').should('be.visible');

      cy.request('POST', '/auth/login', { email, password: 'Segreta123!' }).its('status').should('eq', 200);
    });

    it('rifiuta un\'email già registrata', () => {
      authModal().within(() => {
        cy.get('#auth-register-name').type('Doppione');
        cy.get('#auth-register-email').type(USERS.admin.email);
        cy.get('#auth-register-password').type('Segreta123!');
        cy.contains('button', 'Crea account').click();
        cy.get('.auth-error').should('contain.text', 'Esiste già un account con questa email.');
      });
    });

    it('valida nome e password', () => {
      authModal().within(() => {
        cy.get('#auth-register-name').type('A').blur();
        cy.contains('.form-error', 'minimo 2 caratteri').should('be.visible');
        cy.get('#auth-register-password').type('123').blur();
        cy.contains('.form-error', 'almeno 6 caratteri').should('be.visible');
      });
    });
  });

  describe('sessione', () => {
    beforeEach(() => cy.login('admin'));

    it('per un utente loggato la home sono i viaggi e /login porta ai viaggi', () => {
      cy.visit('/');
      cy.location('pathname').should('eq', '/trips');
      cy.visit('/login');
      cy.location('pathname').should('eq', '/trips');
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('un token non valido chiude la sessione', () => {
      cy.visit('/trips', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_jwt', JSON.stringify('token.non.valido'));
        },
      });
      cy.location('pathname').should('eq', '/explore');
      cy.get('header').contains('button', 'Accedi').should('be.visible');
    });

    it('il logout dal menu utente chiude la sessione e svuota la cache', () => {
      cy.visit('/trips');
      cy.get(`button[title="${USERS.admin.name}"]`).click();
      cy.contains(USERS.admin.email).should('be.visible');
      cy.contains('button', 'Disconnetti').click();

      cy.location('pathname').should('eq', '/explore');
      cy.toast('Disconnessione effettuata').should('be.visible');
      cy.window().its('localStorage').then(ls => {
        expect(ls.getItem('wb_jwt')).to.be.null;
        expect(ls.getItem('wb_current_user')).to.be.null;
        expect(ls.getItem('wb_groups')).to.be.null;
        expect(ls.getItem('wb_trips')).to.be.null;
      });

      cy.visit('/trips');
      cy.location('pathname').should('eq', '/explore');
      authModal().should('be.visible');
    });
  });
});

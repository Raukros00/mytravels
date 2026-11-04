import { uniq } from '../support/e2e';
import { USERS } from '../support/users';

describe('Autenticazione', () => {
  describe('accesso alle pagine protette', () => {
    it('un visitatore viene mandato al login, con returnUrl', () => {
      cy.visit('/groups');
      cy.location('pathname').should('eq', '/login');
      cy.location('search').should('contain', 'returnUrl=%2Fgroups');
    });

    it('un utente in cache senza token non è considerato loggato (residuo modalità mock)', () => {
      cy.visit('/login', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_seed_version', JSON.stringify('10'));
          win.localStorage.setItem(
            'wb_current_user',
            JSON.stringify({ id: 'usr_demo_1', name: 'Alessandro Dominici', email: 'alessandro@example.com' }),
          );
          win.localStorage.setItem('wb_groups', JSON.stringify([{ id: 'grp_1', name: 'Weekend Foodies', members: [] }]));
        },
      });
      cy.location('pathname').should('eq', '/login');
      cy.contains('h1', 'Bentornato').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_current_user').should('be.null');
      cy.window().its('localStorage').invoke('getItem', 'wb_groups').should('be.null');
    });
  });

  describe('login', () => {
    beforeEach(() => cy.visit('/login'));

    it('non ha più il login rapido demo né credenziali precompilate', () => {
      cy.contains('Demo Login Rapido').should('not.exist');
      cy.get('#email').should('have.value', '');
      cy.get('#password').should('have.value', '');
      cy.contains('button', 'Accedi a WanderBite').should('be.disabled');
    });

    it('valida il formato dell\'email', () => {
      cy.get('#email').type('non-una-email').blur();
      cy.contains('.form-error', 'Inserisci un indirizzo email valido.').should('be.visible');
      cy.get('#password').type('qualcosa');
      cy.contains('button', 'Accedi a WanderBite').should('be.disabled');
    });

    it('con credenziali corrette entra e mostra i viaggi', () => {
      cy.intercept('POST', '/auth/login').as('login');
      cy.get('#email').type(USERS.admin.email);
      cy.get('#password').type(USERS.admin.password, { log: false });
      cy.contains('button', 'Accedi a WanderBite').click();

      cy.wait('@login').its('response.statusCode').should('eq', 200);
      cy.location('pathname').should('eq', '/trips');
      cy.toast(`Bentornato, ${USERS.admin.name}!`).should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.a', 'string');
    });

    it('con password errata mostra l\'errore e resta sul login', () => {
      cy.get('#email').type(USERS.admin.email);
      cy.get('#password').type('password-sbagliata');
      cy.contains('button', 'Accedi a WanderBite').click();

      cy.toast('Invalid email or password').should('be.visible');
      cy.location('pathname').should('eq', '/login');
      cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.null');
    });

    it('il link "Registrati ora" porta alla registrazione', () => {
      cy.contains('a', 'Registrati ora').click();
      cy.location('pathname').should('eq', '/register');
    });
  });

  describe('registrazione', () => {
    beforeEach(() => cy.visit('/register'));

    it('crea un nuovo account ed entra', () => {
      const name = uniq('Tester');
      const email = `e2e.${Date.now()}@example.com`;

      cy.contains('button', 'Crea Account ed Entra').should('be.disabled');
      cy.get('#name').type(name);
      cy.get('#email').type(email);
      cy.get('#password').clear().type('Segreta123!');
      cy.get('.avatar-select-btn').eq(2).click().should('have.class', 'selected');
      cy.get('.color-btn').eq(1).click().should('have.class', 'selected');
      cy.contains('button', 'Crea Account ed Entra').click();

      cy.location('pathname').should('eq', '/trips');
      cy.toast(`Benvenuto su WanderBite, ${name}!`).should('be.visible');

      // Un utente nuovo non vede gruppi né viaggi di altri.
      cy.contains('Nessun viaggio ancora').should('be.visible');

      // Il nuovo account funziona anche per il login.
      cy.request('POST', '/auth/login', { email, password: 'Segreta123!' }).its('status').should('eq', 200);
    });

    it('rifiuta un\'email già registrata', () => {
      cy.get('#name').type('Doppione');
      cy.get('#email').type(USERS.admin.email);
      cy.contains('button', 'Crea Account ed Entra').click();

      cy.toast(`Email already exists: ${USERS.admin.email}`).should('be.visible');
      cy.location('pathname').should('eq', '/register');
    });

    it('richiede un nome di almeno 2 caratteri', () => {
      cy.get('#name').type('A').blur();
      cy.contains('.form-error', 'minimo 2 caratteri').should('be.visible');
    });
  });

  describe('sessione', () => {
    beforeEach(() => cy.login('admin'));

    it('un utente loggato che apre /login viene portato ai viaggi', () => {
      cy.visit('/login');
      cy.location('pathname').should('eq', '/trips');
    });

    it('un token non valido fa tornare al login', () => {
      cy.visit('/trips', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_jwt', JSON.stringify('token.non.valido'));
        },
      });
      cy.location('pathname').should('eq', '/login');
    });

    it('il logout dal menu utente chiude la sessione e svuota la cache', () => {
      cy.visit('/trips');
      cy.get(`button[title="${USERS.admin.name}"]`).click();
      cy.contains(USERS.admin.email).should('be.visible');
      cy.contains('button', 'Disconnetti').click();

      cy.location('pathname').should('eq', '/login');
      cy.toast('Disconnessione effettuata').should('be.visible');
      cy.window().its('localStorage').then(ls => {
        expect(ls.getItem('wb_jwt')).to.be.null;
        expect(ls.getItem('wb_current_user')).to.be.null;
        expect(ls.getItem('wb_groups')).to.be.null;
        expect(ls.getItem('wb_trips')).to.be.null;
      });

      cy.visit('/trips');
      cy.location('pathname').should('eq', '/login');
    });
  });
});

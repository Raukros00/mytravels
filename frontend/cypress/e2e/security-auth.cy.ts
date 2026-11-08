import { USERS } from '../support/users';

/** Nessuna chiave `password` (a qualsiasi livello) e nessun hash BCrypt nel JSON. */
function expectNoPassword(body: unknown, what: string) {
  const json = JSON.stringify(body);
  expect(json, `${what}: campo password`).not.to.match(/"password"/i);
  expect(json, `${what}: hash BCrypt`).not.to.match(/\$2[aby]\$\d{2}\$/);
}

describe('Sicurezza – dati dell\'utente nelle API di accesso', () => {
  it('login, registrazione e /auth/me non restituiscono la password', () => {
    cy.request('POST', '/auth/login', { email: USERS.admin.email, password: USERS.admin.password }).then(res => {
      expect(res.body.token).to.be.a('string');
      expect(res.body.user).to.include({ email: USERS.admin.email });
      expectNoPassword(res.body, 'login');
    });

    cy.request('POST', '/auth/register', {
      firstName: 'Senza', lastName: 'Hash', birthDate: '1990-01-01',
      email: `e2e.nohash.${Date.now()}@example.com`, password: 'Segreta123!',
    }).then(res => {
      expect(res.status).to.eq(201);
      expect(res.body.user).to.include({ name: 'Senza Hash' });
      expectNoPassword(res.body, 'registrazione');
    });

    cy.me('admin').then(me => {
      expect(me).to.include({ email: USERS.admin.email, name: USERS.admin.name });
      expect(me).to.have.all.keys(
        'id', 'name', 'firstName', 'lastName', 'birthDate', 'profileImage', 'email', 'avatar', 'color', 'role', 'joinedDate',
      );
      expectNoPassword(me, '/auth/me');
    });
  });

  it('nessuna delle API che restituiscono utenti espone la password', () => {
    ['/api/v1/groups', '/api/v1/notifications', '/api/v1/users/search?q=ma', '/api/v1/trips'].forEach(url => {
      cy.api('admin', 'GET', url).then(body => expectNoPassword(body, url));
    });
  });

  it('dopo il login dalla modale l\'utente salvato nel browser non contiene la password', () => {
    cy.intercept('POST', '/auth/login').as('login');
    cy.visit('/explore');
    cy.get('header button[aria-label="Accedi o registrati"]').click();
    cy.dialog('Accedi o registrati').within(() => {
      cy.get('#auth-login-email').type(USERS.admin.email);
      cy.get('#auth-login-password').type(USERS.admin.password, { log: false });
      cy.contains('button[type="submit"]', 'Continua').click();
    });
    cy.wait('@login').then(({ response }) => expectNoPassword(response?.body, 'login dalla modale'));
    cy.get('[role="dialog"]').should('not.exist');
    cy.window().its('localStorage').invoke('getItem', 'wb_current_user').then(raw => {
      expect(raw).to.be.a('string');
      expect(JSON.parse(raw as string)).to.include({ email: USERS.admin.email });
      expectNoPassword(raw, 'wb_current_user');
    });
  });

  it('un utente salvato con l\'hash (versione precedente) viene ripulito al primo /auth/me', () => {
    cy.apiToken('admin').then(token => {
      cy.intercept('GET', '/auth/me').as('me');
      cy.visit('/trips', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_jwt', JSON.stringify(token));
          win.localStorage.setItem('wb_current_user', JSON.stringify({
            id: 'vecchio', name: USERS.admin.name, email: USERS.admin.email,
            password: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234',
          }));
        },
      });
      cy.wait('@me');
      cy.window().its('localStorage').invoke('getItem', 'wb_current_user').should(raw => {
        expect(raw).to.be.a('string');
        expect(raw).not.to.contain('password');
        expect(JSON.parse(raw as string).id).not.to.eq('vecchio');
      });
    });
  });
});

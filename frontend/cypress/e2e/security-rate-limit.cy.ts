import { USERS } from '../support/users';

/**
 * Limiti ai tentativi (#65). Lo stack e2e gira con limiti altissimi; qui li abbassiamo con l'endpoint
 * di test (esiste solo con RATE_LIMIT_TEST_ENDPOINT=true) e li ripristiniamo alla fine.
 * Ogni test usa IP finti propri via X-Forwarded-For, così i conteggi non si mescolano.
 */
const LIMITS = {
  login: { maxAttempts: 3, windowSeconds: 600 },
  register: { maxAttempts: 2, windowSeconds: 600 },
  invitePreview: { maxAttempts: 3, windowSeconds: 600 },
};

let seq = 0;
const ipBase = Math.floor(Math.random() * 200);
/** IP finto e univoco per questa esecuzione dello spec. */
const fakeIp = () => `10.${ipBase}.${Math.floor(seq / 250)}.${(seq++ % 250) + 1}`;
const uniqueEmail = (prefix: string) => `e2e.${prefix}.${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

function setLimits(limits: Partial<typeof LIMITS>) {
  cy.apiToken('admin').then(token =>
    cy.request({ method: 'PUT', url: '/api/v1/test/rate-limits', body: limits, headers: { Authorization: `Bearer ${token}` } }),
  );
}

function login(email: string, password: string, ip: string) {
  return cy.request({
    method: 'POST', url: '/auth/login', body: { email, password },
    headers: { 'X-Forwarded-For': `${ip}, 10.0.0.1` }, failOnStatusCode: false,
  });
}

function register(email: string, ip: string) {
  return cy.request({
    method: 'POST', url: '/auth/register',
    body: { firstName: 'Limite', lastName: 'Test', birthDate: '1990-01-01', email, password: 'Segreta123!' },
    headers: { 'X-Forwarded-For': ip }, failOnStatusCode: false,
  });
}

/** Registra un utente nuovo (da un IP dedicato) e ne restituisce l'email. */
function newUser(): Cypress.Chainable<string> {
  const email = uniqueEmail('limite');
  return register(email, fakeIp()).then(res => {
    expect(res.status).to.eq(201);
    return email;
  });
}

function expect429(res: Cypress.Response<any>, maxSeconds: number) {
  expect(res.status).to.eq(429);
  const retryAfter = Number(res.headers['retry-after']);
  expect(retryAfter).to.be.within(1, maxSeconds);
  expect(res.body.retryAfterSeconds).to.eq(retryAfter);
  expect(res.body.message).to.match(/^Troppi tentativi, riprova tra \d+ minut[oi]\.$/);
}

describe('Sicurezza – limite ai tentativi di accesso e registrazione', () => {
  beforeEach(() => setLimits(LIMITS));

  after(() => {
    // Ripristina i limiti della configurazione (alti nello stack e2e) per gli spec successivi.
    cy.apiToken('admin').then(token =>
      cy.request({ method: 'DELETE', url: '/api/v1/test/rate-limits', headers: { Authorization: `Bearer ${token}` } }),
    );
  });

  it('dopo N login falliti per la stessa email risponde 429 anche con la password giusta', () => {
    newUser().then(email => {
      // IP sempre diversi: scatta il limite per email, non quello per IP.
      [1, 2, 3].forEach(() => login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401));
      login(email, 'Segreta123!', fakeIp()).then(res => expect429(res, 600));
      // Il limite vale anche scrivendo l'email con maiuscole diverse.
      login(email.toUpperCase(), 'Segreta123!', fakeIp()).its('status').should('eq', 429);
      // Gli altri utenti non sono toccati.
      login(USERS.sofia.email, USERS.sofia.password, fakeIp()).its('status').should('eq', 200);
    });
  });

  it('un login riuscito azzera il conteggio dell\'email', () => {
    newUser().then(email => {
      login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401);
      login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401);
      login(email, 'Segreta123!', fakeIp()).its('status').should('eq', 200);
      login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401);
      login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401);
      login(email, 'Segreta123!', fakeIp()).its('status').should('eq', 200);
    });
  });

  it('dopo N login falliti dallo stesso IP blocca quell\'IP (primo indirizzo di X-Forwarded-For)', () => {
    const ip = fakeIp();
    [1, 2, 3].forEach(() => login(uniqueEmail('nessuno'), 'sbagliata!', ip).its('status').should('eq', 401));
    login(USERS.marco.email, USERS.marco.password, ip).then(res => expect429(res, 600));
    login(USERS.marco.email, USERS.marco.password, fakeIp()).its('status').should('eq', 200);
  });

  it('allo scadere della finestra si può accedere di nuovo', () => {
    setLimits({ ...LIMITS, login: { maxAttempts: 2, windowSeconds: 3 } });
    newUser().then(email => {
      login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401);
      login(email, 'sbagliata!', fakeIp()).its('status').should('eq', 401);
      login(email, 'Segreta123!', fakeIp()).then(res => expect429(res, 3));
      cy.wait(3200);
      login(email, 'Segreta123!', fakeIp()).its('status').should('eq', 200);
    });
  });

  it('limita le registrazioni per IP', () => {
    const ip = fakeIp();
    register(uniqueEmail('reg1'), ip).its('status').should('eq', 201);
    register(uniqueEmail('reg2'), ip).its('status').should('eq', 201);
    register(uniqueEmail('reg3'), ip).then(res => expect429(res, 600));
    register(uniqueEmail('reg4'), fakeIp()).its('status').should('eq', 201);
  });

  it('limita le anteprime dei codici invito per IP', () => {
    const ip = fakeIp();
    cy.apiToken('admin').then(token => {
      const preview = (code: string, from: string) => cy.request({
        url: `/api/v1/groups/invite/${code}`, failOnStatusCode: false,
        headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': from },
      });
      ['NONESISTE1', 'NONESISTE2', 'NONESISTE3'].forEach(code => preview(code, ip).its('status').should('not.eq', 429));
      preview('NONESISTE4', ip).then(res => expect429(res, 600));
      preview('NONESISTE4', fakeIp()).its('status').should('not.eq', 429);
    });
  });

  it('la modale mostra un messaggio chiaro con il tempo di attesa', () => {
    const ip = fakeIp();
    cy.intercept('POST', '/auth/login', req => {
      req.headers['x-forwarded-for'] = ip;
    }).as('login');
    cy.visit('/explore');
    cy.get('header button[aria-label="Accedi o registrati"]').click();
    cy.dialog('Accedi o registrati').within(() => {
      cy.get('#auth-login-email').type(USERS.luca.email);
      cy.get('#auth-login-password').type('sbagliata!');
      [1, 2, 3].forEach(() => {
        cy.contains('button[type="submit"]', 'Continua').click();
        cy.wait('@login').its('response.statusCode').should('eq', 401);
        cy.get('.auth-error').should('contain.text', 'Email o password non corretti.');
      });
      cy.get('#auth-login-password').clear().type(USERS.luca.password);
      cy.contains('button[type="submit"]', 'Continua').click();
      cy.wait('@login').its('response.statusCode').should('eq', 429);
      cy.get('.auth-error').should('contain.text', 'Troppi tentativi, riprova tra 10 minuti.');
    });
    cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.null');
  });

  it('l\'endpoint di test richiede un amministratore', () => {
    // Un utente registrato normalmente ha ruolo USER (gli utenti demo sono tutti ADMIN).
    const email = uniqueEmail('nonadmin');
    register(email, fakeIp()).then(res =>
      cy.request({
        method: 'PUT', url: '/api/v1/test/rate-limits', body: LIMITS, failOnStatusCode: false,
        headers: { Authorization: `Bearer ${res.body.token}` },
      }).its('status').should('eq', 403),
    );
    cy.request({ method: 'DELETE', url: '/api/v1/test/rate-limits', failOnStatusCode: false })
      .its('status').should('be.oneOf', [401, 403]);
  });
});

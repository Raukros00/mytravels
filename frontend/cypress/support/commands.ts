import { DemoUser, USERS } from './users';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type Credentials = { email: string; password: string };
type UserRef = DemoUser | Credentials;

const tokenCache = new Map<string, string>();

function credentialsOf(user: UserRef): Credentials {
  return typeof user === 'string' ? USERS[user] : user;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Login via API e sessione salvata nel localStorage (come fa l'app). */
      login(user?: UserRef): Chainable<void>;
      /** JWT dell'utente, ottenuto via /auth/login e messo in cache per lo spec. */
      apiToken(user: UserRef): Chainable<string>;
      /** Chiamata autenticata al backend, per preparare o verificare i dati. */
      api<T = any>(user: UserRef, method: HttpMethod, url: string, body?: unknown): Chainable<T>;
      /** Gruppo (dal backend) visibile all'utente con il nome indicato. */
      groupByName(user: UserRef, name: string): Chainable<any>;
      /** Crea un viaggio confermato via API nel gruppo indicato. */
      createTrip(user: UserRef, groupName: string, overrides?: Record<string, unknown>): Chainable<any>;
      /**
       * Rilegge `url` dal backend finché `assert` non passa (o scade il timeout).
       * Serve perché l'UI è ottimistica: il toast compare prima che la chiamata al server finisca.
       */
      apiUntil<T = any>(user: UserRef, url: string, assert: (body: T) => void, timeout?: number): Chainable<T>;
      /** Utente corrente secondo il backend (/auth/me). */
      me(user: UserRef): Chainable<any>;
      /** Crea un gruppo via API (l'utente ne è creatore e admin). */
      createGroup(user: UserRef, name: string, extra?: Record<string, unknown>): Chainable<any>;
      /**
       * L'utente entra nel gruppo con il codice invito, via API: invia la richiesta di accesso
       * e `approver` (un admin del gruppo, di solito chi l'ha creato) la approva.
       */
      joinGroup(user: UserRef, inviteCode: string, approver?: UserRef): Chainable<any>;
      /** Toast visibile con il testo indicato. */
      toast(text: string | RegExp): Chainable<JQuery<HTMLElement>>;
      /** Modale aperta (role=dialog) con il titolo indicato. */
      dialog(title: string | RegExp): Chainable<JQuery<HTMLElement>>;
    }
  }
}

Cypress.Commands.add('apiToken', (user: UserRef) => {
  const { email, password } = credentialsOf(user);
  const cached = tokenCache.get(email);
  if (cached) return cy.wrap(cached, { log: false });
  return cy
    .request({ method: 'POST', url: '/auth/login', body: { email, password }, log: false })
    .then(({ body }) => {
      tokenCache.set(email, body.token);
      return body.token as string;
    });
});

Cypress.Commands.add('api', (user: UserRef, method: HttpMethod, url: string, body?: unknown) => {
  return cy.apiToken(user).then(token =>
    cy
      .request({ method, url, body, headers: { Authorization: `Bearer ${token}` } })
      .its('body'),
  );
});

Cypress.Commands.add('login', (user: UserRef = 'admin') => {
  const { email, password } = credentialsOf(user);
  cy.session(
    ['login', email],
    () => {
      cy.request({ method: 'POST', url: '/auth/login', body: { email, password } }).then(({ body }) => {
        // Stesso formato di StorageService (JSON.stringify) e I18nService (stringa semplice).
        window.localStorage.setItem('wb_jwt', JSON.stringify(body.token));
        window.localStorage.setItem('wb_current_user', JSON.stringify(body.user));
        window.localStorage.setItem('wb_lang', 'it');
        tokenCache.set(email, body.token);
      });
    },
    {
      validate() {
        cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.a', 'string');
      },
    },
  );
});

Cypress.Commands.add('groupByName', (user: UserRef, name: string) => {
  return cy.api<any[]>(user, 'GET', '/api/v1/groups').then(groups => {
    const group = groups.find(g => g.name === name);
    expect(group, `gruppo "${name}"`).to.exist;
    return group;
  });
});

Cypress.Commands.add('createTrip', (user: UserRef, groupName: string, overrides: Record<string, unknown> = {}) => {
  return cy.groupByName(user, groupName).then(group =>
    cy.api(user, 'POST', '/api/v1/trips', {
      groupId: group.id,
      title: `E2E viaggio ${Date.now()}`,
      destination: 'Torino',
      country: 'Italia',
      startDate: '2027-06-10',
      endDate: '2027-06-13',
      budgetEstimate: 300,
      currency: 'EUR',
      decision: 'confirmed',
      tags: ['E2E'],
      notes: '',
      ...overrides,
    }),
  );
});

Cypress.Commands.add('apiUntil', (user: UserRef, url: string, assert: (body: any) => void, timeout = 8000) => {
  const started = Date.now();
  const attempt = (): Cypress.Chainable<any> =>
    cy.api(user, 'GET', url).then(body => {
      try {
        assert(body);
        return cy.wrap(body, { log: false });
      } catch (err) {
        if (Date.now() - started > timeout) throw err;
        return cy.wait(250, { log: false }).then(attempt);
      }
    });
  return attempt();
});

Cypress.Commands.add('me', (user: UserRef) => cy.api(user, 'GET', '/auth/me'));

Cypress.Commands.add('createGroup', (user: UserRef, name: string, extra: Record<string, unknown> = {}) => {
  return cy.me(user).then(me =>
    cy.api(user, 'POST', '/api/v1/groups', {
      name,
      description: 'Creato dai test E2E',
      icon: '🧪',
      color: '#0ea5e9',
      creatorId: me.id,
      ...extra,
    }),
  );
});

Cypress.Commands.add('joinGroup', (user: UserRef, inviteCode: string, approver: UserRef = 'admin') => {
  return cy.api<any>(user, 'POST', `/api/v1/groups/invite/${inviteCode}/request`).then(request =>
    cy.api(approver, 'POST', `/api/v1/groups/${request.groupId}/join-requests/${request.id}/approve`),
  );
});

Cypress.Commands.add('toast', (text: string | RegExp) => {
  return cy.get('.toast-container').contains('.toast-item', text);
});

Cypress.Commands.add('dialog', (title: string | RegExp) => {
  return cy.contains('[role="dialog"] .modal-title', title).closest('[role="dialog"]');
});

export {};

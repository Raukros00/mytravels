import itJson from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';
import { DEFAULT_PUSH_PREFERENCES, expectNoPush, rawPushes, receivedPushes, resetPushPreferences, subscribeDevice } from '../support/push';
import { DemoUser } from '../support/users';

/**
 * Preferenze delle notifiche push per tipo (#97): salvate sul server per utente (valgono su tutti
 * i dispositivi), modificabili dal Profilo sotto l'interruttore del dispositivo e rispettate negli invii.
 */
const t = itJson.profile;

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(user: DemoUser, method: string, url: string, body?: Cypress.RequestBody) {
  return cy.apiToken(user).then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

const section = () => cy.contains('.section-card .section-title', t.push_title).closest('.section-card');
const prefSwitch = (category: string) => section().find(`.push-pref[data-category="${category}"] button[role="switch"]`);

describe('Notifiche push – preferenze per tipo', () => {
  beforeEach(() => resetPushPreferences('admin', 'giulia', 'luca'));
  after(() => resetPushPreferences('admin', 'giulia', 'luca'));

  it('API: valori predefiniti, aggiornamento parziale, valori non validi e accesso solo autenticato', () => {
    cy.api('giulia', 'GET', '/api/v1/push/preferences').should('deep.equal', DEFAULT_PUSH_PREFERENCES);

    cy.api('giulia', 'PUT', '/api/v1/push/preferences', { newMembers: true }).should('deep.equal', {
      ...DEFAULT_PUSH_PREFERENCES, newMembers: true,
    });
    cy.api('giulia', 'PUT', '/api/v1/push/preferences', { reminders: false }).should('deep.equal', {
      ...DEFAULT_PUSH_PREFERENCES, newMembers: true, reminders: false,
    });
    // Le preferenze sono dell'utente: quelle degli altri non cambiano.
    cy.api('luca', 'GET', '/api/v1/push/preferences').should('deep.equal', DEFAULT_PUSH_PREFERENCES);

    rawApi('giulia', 'PUT', '/api/v1/push/preferences', { invites: 'no' }).its('status').should('eq', 400);
    cy.api('giulia', 'GET', '/api/v1/push/preferences').its('invites').should('eq', true);
    cy.request({ url: '/api/v1/push/preferences', failOnStatusCode: false }).its('status').should('be.oneOf', [401, 403]);
    cy.request({ method: 'PUT', url: '/api/v1/push/preferences', body: { invites: false }, failOnStatusCode: false })
      .its('status').should('be.oneOf', [401, 403]);
  });

  it('Profilo: le quattro categorie sotto l\'interruttore, con i valori predefiniti; la scelta resta dopo il ricaricamento', () => {
    cy.intercept('PUT', '/api/v1/push/preferences').as('save');
    cy.login('giulia');
    cy.visit('/profile');

    section().should('contain.text', t.push_prefs_title).and('contain.text', t.push_prefs_hint);
    section().find('.push-pref').should('have.length', 4);
    section().should('contain.text', t.push_pref_invites)
      .and('contain.text', t.push_pref_proposals)
      .and('contain.text', t.push_pref_new_members)
      .and('contain.text', t.push_pref_reminders);
    prefSwitch('invites').should('have.attr', 'aria-checked', 'true');
    prefSwitch('proposals').should('have.attr', 'aria-checked', 'true');
    prefSwitch('newMembers').should('have.attr', 'aria-checked', 'false');
    prefSwitch('reminders').should('have.attr', 'aria-checked', 'true');

    prefSwitch('proposals').click();
    cy.wait('@save').its('request.body').should('deep.equal', { proposals: false });
    prefSwitch('proposals').should('have.attr', 'aria-checked', 'false');
    prefSwitch('newMembers').click();
    cy.wait('@save').its('request.body').should('deep.equal', { newMembers: true });
    prefSwitch('newMembers').should('have.attr', 'aria-checked', 'true');

    // Salvate sul server: valgono anche dagli altri dispositivi.
    cy.apiUntil('giulia', '/api/v1/push/preferences', prefs => {
      expect(prefs).to.deep.equal({ ...DEFAULT_PUSH_PREFERENCES, proposals: false, newMembers: true });
    });
    cy.reload();
    prefSwitch('proposals').should('have.attr', 'aria-checked', 'false');
    prefSwitch('newMembers').should('have.attr', 'aria-checked', 'true');
    prefSwitch('invites').should('have.attr', 'aria-checked', 'true');
  });

  it('Profilo: se il salvataggio non riesce l\'interruttore torna com\'era', () => {
    cy.intercept('PUT', '/api/v1/push/preferences', { statusCode: 500, body: {} }).as('save');
    cy.login('giulia');
    cy.visit('/profile');
    prefSwitch('reminders').should('have.attr', 'aria-checked', 'true').click();
    cy.wait('@save');
    cy.toast(t.push_prefs_error).should('be.visible');
    prefSwitch('reminders').should('have.attr', 'aria-checked', 'true');
  });

  it('categoria "Inviti e richieste" disattivata: nessuna push su nessun dispositivo; riattivata: arrivano', () => {
    const name = uniq('E2E Push preferenze');
    cy.api('luca', 'PUT', '/api/v1/push/preferences', { invites: false });
    cy.createGroup('admin', name).then(group => {
      subscribeDevice('luca', { prefix: 'pref-phone' }).then(phone => {
        subscribeDevice('luca', { prefix: 'pref-desktop' }).then(desktop => {
          cy.me('luca').then(luca => {
            cy.api('admin', 'POST', '/api/v1/notifications', { groupId: group.id, recipientId: luca.id });
            // La notifica nella campanella c'è comunque, la push no.
            cy.apiUntil<any[]>('luca', '/api/v1/notifications', list => {
              expect(list.some(n => n.groupId === group.id)).to.be.true;
            });
            expectNoPush(phone);
            rawPushes(desktop).should('have.length', 0);

            // Anche chi gestisce le richieste può disattivarle: l'admin non riceve la richiesta di Luca.
            cy.api('admin', 'PUT', '/api/v1/push/preferences', { invites: false });
            subscribeDevice('admin', { prefix: 'pref-admin' }).then(admin => {
              cy.api<any>('giulia', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`);
              expectNoPush(admin);

              // Riattivata la categoria, le push riprendono su tutti i dispositivi.
              cy.api('admin', 'PUT', '/api/v1/push/preferences', { invites: true });
              cy.api('luca', 'PUT', '/api/v1/push/preferences', { invites: true });
              const other = uniq('E2E Push preferenze 2');
              cy.createGroup('admin', other).then(group2 => {
                cy.api('admin', 'POST', '/api/v1/notifications', { groupId: group2.id, recipientId: luca.id });
                [phone, desktop].forEach(device =>
                  receivedPushes(device).then(([msg]) => {
                    expect(msg.payload.notification.title).to.eq('Nuovo invito');
                    expect(msg.payload.notification.tag).to.eq(`invite:${group2.id}`);
                  }),
                );
              });
            });
          });
        });
      });
    });
  });

  it('il gruppo silenziato ha la precedenza sulla categoria attiva', () => {
    const name = uniq('E2E Push silenzio');
    cy.createGroup('admin', name).then(group => {
      cy.api('admin', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true });
      subscribeDevice('admin', { prefix: 'pref-muted' }).then(admin => {
        cy.api('admin', 'GET', '/api/v1/push/preferences').its('invites').should('eq', true);
        cy.api('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`);
        expectNoPush(admin);
      });
    });
  });
});

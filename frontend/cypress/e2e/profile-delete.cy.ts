import itJson from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';

/** #121: eliminazione dell'account dal Profilo ("Zona pericolosa"). Solo account creati dal test. */
const t = itJson.profile;
const PASSWORD = 'Segreta123!';

type TestUser = { email: string; password: string; name: string };

function registerUser(prefix: string): Cypress.Chainable<TestUser> {
  const user = { email: `e2e.del.${prefix}.${Date.now()}.${Cypress._.random(1e6)}@example.com`, password: PASSWORD };
  const first = uniq('Del');
  return cy.request('POST', '/auth/register', {
    firstName: first, lastName: 'Account', birthDate: '1990-01-01', ...user, avatar: '🎒',
  }).then(() => ({ ...user, name: `${first} Account` }));
}

const openDeleteModal = () => {
  cy.visit('/profile');
  cy.contains('.danger-zone .section-title', t.danger_title).should('be.visible');
  cy.contains('button', t.delete_button).click();
  return cy.dialog(t.delete_title);
};

describe('Profilo: eliminazione dell\'account (#121)', () => {
  it('password errata: l\'account resta', () => {
    registerUser('wrong').then(user => {
      cy.login(user);
      openDeleteModal().within(() => {
        cy.contains(t.delete_intro).should('be.visible');
        cy.contains('button', t.delete_confirm).should('be.disabled');
        cy.get('#delete-account-password').type('password-sbagliata');
        cy.contains('button', t.delete_confirm).click();
        cy.contains('.form-error', t.delete_wrong_password).should('be.visible');
      });
      cy.location('pathname').should('eq', '/profile');
      cy.me(user).its('email').should('eq', user.email);
    });
  });

  it('unico admin di un gruppo con altri membri: bloccato, con il link al gruppo', () => {
    registerUser('admin').then(admin => {
      registerUser('member').then(member => {
        const group = uniq('E2E Unico admin');
        cy.createGroup(admin, group).then((g: any) => {
          cy.joinGroup(member, g.inviteCode, admin);

          // API: 409 con l'elenco dei gruppi.
          cy.apiToken(admin).then(token => cy.request({
            method: 'DELETE', url: '/api/v1/users/me', body: { password: PASSWORD }, failOnStatusCode: false,
            headers: { Authorization: `Bearer ${token}` },
          })).then(res => {
            expect(res.status).to.eq(409);
            expect(res.body.groups.map((x: any) => x.id)).to.include(g.id);
          });

          cy.login(admin);
          openDeleteModal().within(() => {
            cy.contains(t.delete_blocked).should('be.visible');
            cy.get('#delete-account-password').should('not.exist');
            cy.contains('button', t.delete_confirm).should('not.exist');
            cy.contains('a.delete-group-link', group).click();
          });
          cy.location('pathname').should('eq', `/groups/${g.id}`);
          cy.me(admin).its('email').should('eq', admin.email);
        });
      });
    });
  });

  it('eliminazione riuscita: gruppi da solo eliminati, contenuti condivisi restano con "Utente eliminato"', () => {
    registerUser('leaver').then(leaver => {
      registerUser('stayer').then(stayer => {
        const soloGroup = uniq('E2E Solo mio');
        const shared = uniq('E2E Condiviso');
        cy.createGroup(leaver, soloGroup);
        cy.createGroup(stayer, shared).then((g: any) => {
          cy.joinGroup(leaver, g.inviteCode, stayer);
          cy.me(leaver).then(me => {
            cy.createTrip(stayer, shared, { title: 'Viaggio condiviso', destination: 'Roma', country: 'Italia', startDate: '2030-01-10', endDate: '2030-01-12' })
              .then((trip: any) => {
                cy.me(stayer).then(st => {
                  cy.api(leaver, 'POST', `/api/v1/trips/${trip.id}/expenses`, {
                    title: 'Cena', amount: 40, category: 'food', date: '2030-01-10', paidBy: me.id,
                    splitAmong: [me.id, st.id], shares: { [me.id]: 20, [st.id]: 20 }, type: 'expense',
                  });
                });

                cy.login(leaver);
                openDeleteModal().within(() => {
                  // Avviso sui gruppi in cui è l'unico membro.
                  cy.contains(t.delete_groups_deleted).should('be.visible');
                  cy.contains('.delete-group-list--deleted li', soloGroup).should('be.visible');
                  cy.contains('.delete-group-list--deleted li', shared).should('not.exist');
                  cy.get('#delete-account-password').type(PASSWORD);
                  cy.contains('button', t.delete_confirm).click();
                });

                cy.toast(t.delete_done).should('be.visible');
                cy.location('pathname').should('eq', '/explore');
                cy.window().then(win => {
                  expect(win.localStorage.getItem('wb_jwt')).to.be.null;
                  expect(win.localStorage.getItem('wb_current_user')).to.be.null;
                });

                // Il vecchio token non funziona più e non si può più accedere.
                cy.apiToken(leaver).then(token => {
                  cy.request({ url: '/auth/me', headers: { Authorization: `Bearer ${token}` }, failOnStatusCode: false })
                    .its('status').should('eq', 401);
                });
                cy.request({ method: 'POST', url: '/auth/login', body: { email: leaver.email, password: PASSWORD }, failOnStatusCode: false })
                  .its('status').should('eq', 401);

                // Il gruppo condiviso resta, senza l'utente; viaggio e spesa restano.
                cy.groupByName(stayer, shared).then(after => {
                  expect(after.members.map((m: any) => m.id)).not.to.include(me.id);
                  expect(after.deletedMemberIds).to.include(me.id);
                });
                cy.api(stayer, 'GET', `/api/v1/trips/${trip.id}`).then(tr => {
                  expect(tr.expenses).to.have.length(1);
                });

                cy.login(stayer);
                cy.visit(`/trips/${trip.id}`);
                cy.contains('.trip-tab-btn', 'Spese').click();
                cy.contains('Utente eliminato ha pagato').should('be.visible');
              });
          });
        });
      });
    });
  });

  it('unico membro di un gruppo: il gruppo viene eliminato (API)', () => {
    registerUser('solo').then(user => {
      const group = uniq('E2E Da eliminare');
      cy.createGroup(user, group).then((g: any) => {
        cy.createTrip(user, group, { title: 'Solo io', startDate: '2030-02-01', endDate: '2030-02-02' });
        cy.apiToken(user).then(token => cy.request({
          method: 'DELETE', url: '/api/v1/users/me', body: { password: PASSWORD },
          headers: { Authorization: `Bearer ${token}` },
        })).its('status').should('eq', 204);
        // Il gruppo non esiste più: un altro utente non lo trova con il codice invito.
        cy.apiToken('admin').then(token => cy.request({
          url: `/api/v1/groups/invite/${g.inviteCode}`, failOnStatusCode: false,
          headers: { Authorization: `Bearer ${token}` },
        })).its('status').should('eq', 404);
      });
    });
  });

  it('"Scarica i miei dati" restituisce un JSON senza password', () => {
    registerUser('export').then(user => {
      cy.api(user, 'GET', '/api/v1/users/me/export').then(data => {
        expect(data.profile.email).to.eq(user.email);
        expect(JSON.stringify(data)).not.to.match(/"password"/);
        expect(data).to.have.property('groups');
        expect(data).to.have.property('notifications');
      });
      cy.login(user);
      cy.visit('/profile');
      cy.contains('button', t.export_button).should('be.visible').and('not.be.disabled');
    });
  });
});

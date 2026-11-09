import itJson from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';
import { isoYearsAgo } from '../../src/app/core/utils/date.utils';

/** #120: modifica dei dati personali, della foto e dell'avatar dal Profilo. */
const t = itJson.profile;

function registerUser(prefix: string) {
  const user = { email: `e2e.${prefix}.${Date.now()}@example.com`, password: 'Segreta123!' };
  const first = uniq('Edo');
  return cy.request('POST', '/auth/register', {
    firstName: first, lastName: 'Prima', birthDate: '1991-02-03', ...user, avatar: '🎒', color: '#10b981',
  }).then(() => ({ ...user, name: `${first} Prima` }));
}

const openEdit = () => {
  cy.contains('button', t.edit_button).click();
  return cy.dialog(t.edit_title);
};

describe('Profilo: modifica dei dati personali (#120)', () => {
  it('nome, cognome, data di nascita e avatar si salvano e compaiono subito, anche nei gruppi', () => {
    registerUser('edit').then(user => {
      const group = uniq('E2E Modifica');
      cy.createGroup(user, group);
      const newFirst = uniq('Nuovo');
      const newName = `${newFirst} Cognome`;

      cy.login(user);
      cy.visit('/profile');
      cy.contains('.profile-hero h2', user.name).should('be.visible');

      openEdit().within(() => {
        cy.get('#profile-edit-first-name').should('have.value', user.name.split(' ')[0]);
        cy.get('#profile-edit-last-name').should('have.value', 'Prima');
        cy.get('#profile-edit-birth-date').should('have.value', '1991-02-03');
        cy.get('#profile-edit-first-name').clear().type(newFirst);
        cy.get('#profile-edit-last-name').clear().type('Cognome');
        cy.get('#profile-edit-birth-date').clear().type('1988-11-20');
        cy.contains('.avatar-select-btn', '📸').click();
        cy.contains('button', t.edit_save).click();
      });

      cy.toast(t.edit_saved).should('be.visible');
      cy.get('[role="dialog"]').should('not.exist');
      cy.contains('.profile-hero h2', newName).should('be.visible');
      cy.get('.profile-hero app-user-avatar').should('contain.text', '📸');
      cy.contains('.account-label', t.field_birth_date).next().should('have.text', '20 novembre 1988');

      // Backend: utente e copia nei membri del gruppo aggiornati.
      cy.me(user).its('name').should('eq', newName);
      cy.groupByName(user, group).then(g => {
        const me = g.members.find((m: any) => m.name === newName);
        expect(me, 'membro con il nuovo nome').to.exist;
        expect(me.avatar).to.eq('📸');
        cy.visit(`/groups/${g.id}`);
        cy.contains('.member-name', newName).should('be.visible');
      });

      // Dopo un ricaricamento i dati restano.
      cy.visit('/profile');
      cy.contains('.profile-hero h2', newName).should('be.visible');
    });
  });

  it('il nuovo nome compare agli altri membri del gruppo', () => {
    registerUser('edit-other').then(owner => {
      registerUser('edit-member').then(member => {
        const group = uniq('E2E Nome condiviso');
        cy.createGroup(owner, group).then((g: any) => {
          cy.joinGroup(member, g.inviteCode, owner);
          const newFirst = uniq('Rinominato');
          cy.api(member, 'GET', '/auth/me').then(me => {
            cy.api(member, 'PUT', '/api/v1/users/me', {
              firstName: newFirst, lastName: 'Membro', birthDate: me.birthDate, avatar: me.avatar, profileImage: null,
            });
          });
          cy.login(owner);
          cy.visit(`/groups/${g.id}`);
          cy.contains('.member-name', `${newFirst} Membro`).should('be.visible');
          cy.contains('.member-name', member.name).should('not.exist');
        });
      });
    });
  });

  it('foto profilo: si carica con il ritaglio 1:1 e si può rimuovere', () => {
    registerUser('photo').then(user => {
      cy.login(user);
      cy.visit('/profile');
      openEdit().within(() => {
        cy.get('#profile-edit-photo').selectFile('cypress/fixtures/profile-photo.png', { force: true });
        cy.get('.cropper-stage').should('be.visible');
        cy.get('.cropper-mask').should('not.have.class', 'cropper-mask--rect');
        cy.contains('button', 'Usa questa foto').click();
        cy.get('.cropper-stage').should('not.exist');
        cy.get('.edit-preview img').should('have.attr', 'src').and('match', /^data:image\/jpeg;base64,/);
        // Con la foto non si sceglie l'avatar.
        cy.get('.avatar-grid').should('not.exist');
        cy.contains('button', t.edit_save).click();
      });
      cy.toast(t.edit_saved).should('be.visible');
      cy.get('.profile-hero app-user-avatar img').should('have.attr', 'src').and('match', /^data:image\/jpeg;base64,/);
      cy.me(user).its('profileImage').should('match', /^data:image\/jpeg;base64,/);

      openEdit().within(() => {
        cy.contains('button', t.edit_photo_remove).click();
        cy.get('.avatar-grid').should('be.visible');
        cy.contains('button', t.edit_save).click();
      });
      cy.toast(t.edit_saved).should('be.visible');
      cy.get('.profile-hero app-user-avatar img').should('not.exist');
      cy.me(user).its('profileImage').should('be.null');
    });
  });

  it('formato della foto non valido: messaggio e nessun ritaglio', () => {
    registerUser('photo-bad').then(user => {
      cy.login(user);
      cy.visit('/profile');
      openEdit().within(() => {
        cy.get('#profile-edit-photo').selectFile('cypress/fixtures/not-an-image.txt', { force: true });
        cy.contains('.form-error', t.edit_photo_format).should('be.visible');
        cy.get('.cropper-stage').should('not.exist');
      });
    });
  });

  it('validazioni come la registrazione: campi obbligatori ed età minima', () => {
    registerUser('validate').then(user => {
      cy.login(user);
      cy.visit('/profile');
      openEdit().within(() => {
        cy.get('#profile-edit-first-name').clear().blur();
        cy.contains('.form-error', t.edit_first_name_required).should('be.visible');
        cy.contains('button', t.edit_save).should('be.disabled');
        cy.get('#profile-edit-first-name').type('Ok');

        cy.get('#profile-edit-birth-date').clear().type(isoYearsAgo(10));
        cy.contains('.form-error', 'almeno 14 anni').should('be.visible');
        cy.contains('button', t.edit_save).should('be.disabled');

        cy.contains('button', t.edit_cancel).click();
      });
      cy.get('[role="dialog"]').should('not.exist');
      cy.contains('.profile-hero h2', user.name).should('be.visible');
    });
  });

  describe('API PUT /api/v1/users/me', () => {
    it('rifiuta dati non validi e richiede l\'autenticazione', () => {
      registerUser('api').then(user => {
        const base = { firstName: 'Mario', lastName: 'Rossi', birthDate: '1990-01-01', avatar: '🎒', profileImage: null };
        const put = (body: Record<string, unknown>) => cy.apiToken(user).then(token => cy.request({
          method: 'PUT', url: '/api/v1/users/me', body, failOnStatusCode: false,
          headers: { Authorization: `Bearer ${token}` },
        }));

        put({ ...base, birthDate: isoYearsAgo(13) }).its('status').should('eq', 400);
        put({ ...base, firstName: '  ' }).its('status').should('eq', 400);
        put({ ...base, lastName: 'x'.repeat(101) }).its('status').should('eq', 400);
        put({ ...base, profileImage: 'https://example.com/foto.jpg' }).its('status').should('eq', 400);
        put({ ...base, profileImage: 'data:image/svg+xml;base64,PHN2Zz4=' }).its('status').should('eq', 400);

        put({ ...base, email: 'altro@example.com', password: 'nuova-password-123' }).then(res => {
          expect(res.status).to.eq(200);
          expect(res.body.name).to.eq('Mario Rossi');
          // Email e password non si cambiano da qui; la password non esce mai.
          expect(res.body.email).to.eq(user.email);
          expect(res.body).not.to.have.property('password');
        });
        cy.request('POST', '/auth/login', { email: user.email, password: user.password }).its('status').should('eq', 200);

        cy.request({ method: 'PUT', url: '/api/v1/users/me', body: base, failOnStatusCode: false })
          .its('status').should('be.oneOf', [401, 403]);
      });
    });
  });
});

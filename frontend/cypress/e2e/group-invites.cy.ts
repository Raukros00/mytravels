import i18n from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';
import { USERS } from '../support/users';

const t = i18n.groups;

function rawApi(user: 'admin' | 'sofia' | 'marco' | 'luca' | 'giulia', method: string, url: string, body?: unknown) {
  return cy.apiToken(user).then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

function loginInModal(email: string, password: string) {
  cy.dialog('Accedi o registrati').within(() => {
    cy.get('#auth-login-email').type(email);
    cy.get('#auth-login-password').type(password, { log: false });
    cy.contains('button', 'Continua').click();
  });
}

describe('Inviti ai gruppi – link e codice', () => {
  it('la modale "Invita" mostra il link con il codice e lo copia', () => {
    const name = uniq('E2E Link');
    cy.createGroup('admin', name).then(group => {
      cy.login('admin');
      cy.visit(`/groups/${group.id}`);
      cy.window().then(win => cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves());
      cy.contains('button', t.invite_btn).click();

      cy.dialog(t.share_title).within(() => {
        cy.get('input[aria-label="Link di invito"]').should('have.value', `${Cypress.config('baseUrl')}/join/${group.inviteCode}`);
        cy.contains('button', t.share_copy_link).click();
      });
      cy.get('@copy').should('have.been.calledWith', `${Cypress.config('baseUrl')}/join/${group.inviteCode}`);
      cy.toast('Link di invito copiato negli appunti!').should('be.visible');

      cy.dialog(t.share_title).find(`button[title="${t.share_copy_code}"]`).click();
      cy.get('@copy').should('have.been.calledWith', group.inviteCode);
    });
  });

  it('chi apre il link invia una richiesta, l\'admin la accetta e il richiedente entra', () => {
    const name = uniq('E2E Richiesta');
    cy.createGroup('marco', name, { description: 'Gruppo per provare gli inviti' }).then(group => {
      cy.login('luca');
      cy.visit(`/join/${group.inviteCode}`);
      cy.contains('.join-eyebrow', 'Invito a un gruppo').should('be.visible');
      cy.contains('h1', name).should('be.visible');
      cy.contains('Gruppo per provare gli inviti').should('be.visible');
      cy.contains('.join-members', '1 membro').should('be.visible');
      cy.contains('.join-question', `Vuoi inviare la richiesta di accesso a ${name}?`).should('be.visible');

      cy.intercept('POST', `/api/v1/groups/invite/${group.inviteCode}/request`).as('request');
      cy.contains('button', 'Invia richiesta').click();
      cy.wait('@request').its('response.statusCode').should('eq', 201);
      cy.contains('[role="status"]', 'Richiesta inviata').should('be.visible');
      // La richiesta resta in attesa anche ricaricando.
      cy.reload();
      cy.contains('[role="status"]', 'Richiesta inviata').should('be.visible');
      cy.contains('button', 'Invia richiesta').should('not.exist');

      // L'admin riceve la notifica e accetta dalla pagina del gruppo.
      cy.login('marco');
      cy.visit('/groups');
      cy.get('button[title="Notifiche"]').click();
      cy.contains('header p', name).should('contain.text', 'Luca').and('contain.text', 'chiede di entrare');
      cy.contains('header a', 'Gestisci richiesta').click();
      cy.location('pathname').should('eq', `/groups/${group.id}`);
      cy.contains('.section-title', t.join_requests_title).closest('.section-card').within(() => {
        cy.contains('.jr-name', 'Luca').should('be.visible');
        cy.contains('button', t.join_requests_approve).click();
      });
      cy.toast('Luca è entrato nel gruppo.').should('be.visible');
      cy.contains('.section-title', t.join_requests_title).should('not.exist');
      cy.contains('.member-row', 'Luca').should('be.visible');
      cy.me('luca').then(luca => {
        cy.apiUntil('marco', `/api/v1/groups/${group.id}`, g => expect(g.members.map((m: any) => m.id)).to.include(luca.id));
      });

      // Il richiedente riceve l'esito e vede il gruppo.
      cy.login('luca');
      cy.visit('/groups');
      cy.contains('.group-name', name).should('be.visible');
      cy.get('button[title="Notifiche"]').click();
      cy.contains('header p', 'è stata accettata').should('contain.text', name);
      cy.visit(`/join/${group.inviteCode}`);
      cy.contains('Fai già parte di questo gruppo.').should('be.visible');
      cy.contains('a', 'Apri il gruppo').click();
      cy.location('pathname').should('eq', `/groups/${group.id}`);
    });
  });

  it('una richiesta rifiutata viene notificata e si può ripetere', () => {
    const name = uniq('E2E Rifiuto');
    cy.createGroup('marco', name).then(group => {
      cy.api<any>('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`).then(request => {
        cy.login('marco');
        cy.visit(`/groups/${group.id}`);
        cy.contains('.section-title', t.join_requests_title).closest('.section-card')
          .contains('button', t.join_requests_decline).click();
        cy.toast('Richiesta di Luca rifiutata.').should('be.visible');
        cy.api<any>('marco', 'GET', `/api/v1/groups/${group.id}`).its('members').should('have.length', 1);
        rawApi('marco', 'POST', `/api/v1/groups/${group.id}/join-requests/${request.id}/approve`).its('status').should('eq', 409);
      });

      cy.login('luca');
      cy.visit(`/join/${group.inviteCode}`);
      cy.contains('La tua richiesta precedente è stata rifiutata').should('be.visible');
      cy.contains('button', 'Invia richiesta').click();
      cy.contains('[role="status"]', 'Richiesta inviata').should('be.visible');
      cy.get('button[title="Notifiche"]').click();
      cy.contains('header p', 'non è stata accettata').should('contain.text', name);
    });
  });

  it('un visitatore che apre il link accede dalla modale e torna all\'invito', () => {
    const name = uniq('E2E Link ospite');
    cy.createGroup('marco', name).then(group => {
      cy.visit(`/join/${group.inviteCode}`);
      cy.location('pathname').should('eq', '/explore');
      loginInModal(USERS.luca.email, USERS.luca.password);
      cy.location('pathname').should('eq', `/join/${group.inviteCode}`);
      cy.contains('h1', name).should('be.visible');
      cy.contains('button', 'Invia richiesta').should('be.visible');
    });
  });

  it('un link non valido mostra "Invito non valido"', () => {
    cy.login('luca');
    cy.visit('/join/NON-ESISTE');
    cy.contains('h1', 'Invito non valido').should('be.visible');
    cy.contains('a', 'Vai ai tuoi gruppi').click();
    cy.location('pathname').should('eq', '/groups');
  });

  it('un membro non admin non vede le richieste di accesso', () => {
    const name = uniq('E2E Non admin');
    cy.createGroup('marco', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode, 'marco');
      cy.api('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`);
      cy.login('sofia');
      cy.visit(`/groups/${group.id}`);
      cy.contains('.group-hero-name', name).should('be.visible');
      cy.contains('.section-title', t.members_title).should('be.visible');
      cy.contains('.section-title', t.join_requests_title).should('not.exist');
      rawApi('sofia', 'GET', `/api/v1/groups/${group.id}/join-requests`).its('status').should('eq', 403);
    });
  });
});

describe('Inviti ai gruppi – ricerca utenti', () => {
  it('dalla modale "Invita" si cerca un utente e lo si invita; l\'invitato accetta', () => {
    const name = uniq('E2E Ricerca');
    cy.createGroup('admin', name).then(group => {
      cy.login('admin');
      cy.visit(`/groups/${group.id}`);
      cy.contains('button', t.invite_btn).click();
      cy.dialog(t.share_title).within(() => {
        cy.get('input[aria-label="Cerca utenti da invitare"]').type('g');
        cy.contains('Scrivi almeno 2 caratteri.').should('be.visible');
        cy.get('input[aria-label="Cerca utenti da invitare"]').type('iuli');
        cy.contains('.us-row', 'Giulia').contains('button', t.share_invite_btn).click();
      });
      cy.toast('Invito inviato a Giulia!').should('be.visible');

      // Riaprendo la modale l'invito in attesa è segnato.
      cy.dialog(t.share_title).find('button[aria-label="Chiudi modale"]').click();
      cy.contains('button', t.invite_btn).click();
      cy.dialog(t.share_title).within(() => {
        cy.get('input[aria-label="Cerca utenti da invitare"]').type('Giulia');
        cy.contains('.us-row', 'Giulia').should('contain.text', 'Invitato');
      });

      cy.login('giulia');
      cy.visit('/groups');
      cy.get('button[title="Notifiche"]').click();
      cy.contains('header p', name).should('contain.text', 'ti ha invitato');
      cy.contains('header button', 'Accetta').click();
      cy.toast(`Ti sei unito al gruppo "${name}"!`).should('be.visible');
      cy.contains('.group-name', name).should('be.visible');
    });
  });

  it('gli inviti scelti alla creazione del gruppo partono con il gruppo salvato', () => {
    const name = uniq('E2E Crea con inviti');
    cy.login('admin');
    cy.visit('/groups');
    cy.contains('button', t.new_btn).click();
    cy.dialog(t.form_create_title).within(() => {
      cy.get('#gcm-name').type(name);
      cy.get('input[aria-label="Cerca utenti da invitare"]').type('Luca');
      cy.contains('.us-row', 'Luca').contains('button', t.form_invite_action).click();
      cy.contains('.invite-sent-pill', 'Luca').should('be.visible');
      cy.contains('button', t.form_create).click();
    });
    cy.toast(`Gruppo "${name}" creato con successo!`).should('be.visible');
    cy.toast('Invito inviato a Luca.').should('be.visible');

    cy.apiUntil<any[]>('luca', '/api/v1/notifications', notifs => {
      const invite = notifs.find(n => n.type === 'group_invite' && n.groupName === name);
      expect(invite, 'invito a Luca').to.exist;
      expect(invite.groupId, 'id definitivo del gruppo').not.to.match(/^grp_/);
    });
  });

  it('la ricerca non espone le email e accetta l\'email solo se completa', () => {
    rawApi('admin', 'GET', '/api/v1/users/search?q=giulia').then(res => {
      expect(res.status).to.eq(200);
      expect(res.body.map((u: any) => u.name)).to.include('Giulia');
      res.body.forEach((u: any) => expect(u).not.to.have.property('email'));
    });
    rawApi('admin', 'GET', '/api/v1/users/search?q=giulia@example.com').its('body.length').should('eq', 1);
    rawApi('admin', 'GET', '/api/v1/users/search?q=example.com').its('body.length').should('eq', 0);
    rawApi('admin', 'GET', '/api/v1/users/search?q=a').its('body.length').should('eq', 0);
  });
});

describe('Inviti ai gruppi – sicurezza delle notifiche', () => {
  it('ognuno vede solo le proprie notifiche, anche passando un altro recipientId', () => {
    cy.me('giulia').then(giulia => {
      rawApi('sofia', 'GET', `/api/v1/notifications?recipientId=${giulia.id}`).then(res => {
        expect(res.status).to.eq(200);
        res.body.forEach((n: any) => expect(n.recipientId).not.to.eq(giulia.id));
      });
    });
  });

  it('solo un membro del gruppo può invitare', () => {
    const name = uniq('E2E Invito non membro');
    cy.createGroup('marco', name).then(group => {
      cy.me('giulia').then(giulia => {
        rawApi('luca', 'POST', '/api/v1/notifications', { recipientId: giulia.id, groupId: group.id }).its('status').should('eq', 404);
        rawApi('marco', 'POST', '/api/v1/notifications', { recipientId: giulia.id, groupId: group.id }).its('status').should('eq', 201);
      });
    });
  });
});

describe('Creazione gruppo – foto ritagliata', () => {
  it('l\'immagine scelta si ritaglia prima di diventare l\'icona del gruppo', () => {
    const name = uniq('E2E Icona');
    cy.login('admin');
    cy.visit('/groups');
    cy.contains('button', t.new_btn).click();
    cy.dialog(t.form_create_title).within(() => {
      cy.get('#gcm-name').type(name);
      cy.get('#group-icon-file').selectFile('cypress/fixtures/profile-photo.png', { force: true });
      cy.get('.cropper-stage').should('be.visible');
      cy.get('input[aria-label="Zoom"]').invoke('val', 1.8).trigger('input');
      cy.contains('button', 'Usa questa foto').click();
      cy.get('.cropper-stage').should('not.exist');
      cy.get('.img-thumb-img').should('have.attr', 'src').and('match', /^data:image\/jpeg;base64,/);
      cy.contains('button', t.form_create).click();
    });
    cy.toast(`Gruppo "${name}" creato con successo!`).should('be.visible');
    cy.groupByName('admin', name).its('icon').should('match', /^data:image\/jpeg;base64,/);
    cy.contains('.group-card', name).find('img.group-icon-img').should('be.visible');
  });

  it('annullando il ritaglio l\'icona non cambia', () => {
    cy.login('admin');
    cy.visit('/groups');
    cy.contains('button', t.new_btn).click();
    cy.dialog(t.form_create_title).within(() => {
      cy.get('#group-icon-file').selectFile('cypress/fixtures/profile-photo.png', { force: true });
      cy.contains('.cropper-actions button', 'Annulla').click();
      cy.get('.cropper-stage').should('not.exist');
      cy.get('.img-thumb-img').should('not.exist');
    });
  });
});

describe('Membri con foto profilo', () => {
  it('la card dei membri e la lista gruppi mostrano la foto, non l\'emoji', () => {
    const stamp = Date.now();
    const owner = { email: `e2e.foto.owner.${stamp}@example.com`, password: 'Segreta123!' };
    const guest = { email: `e2e.foto.guest.${stamp}@example.com`, password: 'Segreta123!' };
    const name = uniq('E2E Gruppo foto');

    cy.fixture('profile-photo.png', 'base64').then(png => {
      const photo = `data:image/png;base64,${png}`;
      const register = (u: typeof owner, first: string) => cy.request('POST', '/auth/register', {
        firstName: first, lastName: 'Foto', birthDate: '1990-01-01', ...u, avatar: '🎒', color: '#10b981', profileImage: photo,
      });
      register(owner, 'Olga');
      register(guest, 'Gino');

      cy.createGroup(owner, name).then(group => {
        // Chi entra tramite richiesta approvata porta con sé la foto.
        cy.joinGroup(guest, group.inviteCode, owner);

        cy.login(owner);
        cy.visit(`/groups/${group.id}`);
        cy.contains('.member-row', 'Olga Foto').find('img.avatar-photo').should('have.attr', 'src', photo);
        cy.contains('.member-row', 'Gino Foto').find('img.avatar-photo').should('have.attr', 'src', photo);
        cy.contains('.member-row', 'Olga Foto').should('not.contain.text', '🎒');

        cy.visit('/groups');
        cy.contains('.group-card', name).find('img.avatar-photo').should('have.length', 2);
      });
    });
  });
});

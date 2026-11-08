import { uniq } from '../support/e2e';
import { PushDevice, expectNoPush, rawPushes, receivedPushes, resetPushPreferences, subscribeDevice } from '../support/push';
import { USERS } from '../support/users';

/**
 * Push per proposte di viaggio, approvazioni per maggioranza e nuovi membri (#98), verificate sul
 * finto push service: destinatari, testo, link e tag; preferenze per tipo (#97) e gruppi silenziati.
 */

/** Notifica (decifrata) ricevuta dal dispositivo, la `index`-esima. */
function notification(device: PushDevice, index = 0) {
  return receivedPushes(device, index + 1).then(list => list[index].payload.notification);
}

const expectOpens = (n: any, url: string) => {
  expect(n.data.url).to.eq(url);
  expect(n.data.onActionClick.default).to.deep.equal({ operation: 'navigateLastFocusedOrOpen', url });
};

/** Proposta di viaggio creata via API da `user` nel gruppo. */
function propose(user: 'admin' | 'sofia' | 'marco' | 'giulia' | 'luca', groupName: string, title: string) {
  return cy.createTrip(user, groupName, { title, decision: 'proposal' });
}

describe('Notifiche push – proposte, approvazioni e nuovi membri', () => {
  beforeEach(() => resetPushPreferences('admin', 'sofia', 'marco', 'giulia', 'luca'));
  after(() => resetPushPreferences('admin', 'sofia', 'marco', 'giulia', 'luca'));

  it('nuova proposta: push a tutti i membri tranne l\'autore, con il link al gruppo per votare', () => {
    const name = uniq('E2E Push proposta');
    const title = uniq('Weekend a Lisbona');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode);
      cy.joinGroup('marco', group.inviteCode);
      subscribeDevice('admin', { prefix: 'prop-author' }).then(author => {
        subscribeDevice('sofia', { prefix: 'prop-sofia' }).then(sofia => {
          subscribeDevice('marco', { prefix: 'prop-marco', lang: 'en' }).then(marco => {
            // Un viaggio già confermato non è una proposta: nessuna push.
            cy.createTrip('admin', name, { title: uniq('Confermato') });
            expectNoPush(sofia);

            propose('admin', name, title).then(trip => {
              notification(sofia).then(n => {
                expect(n.title).to.eq('Nuova proposta di viaggio');
                expect(n.body).to.eq(`${USERS.admin.name} propone «${title}»: vota!`);
                expect(n.tag).to.eq(`proposal:${trip.id}`);
                expectOpens(n, `/groups/${group.id}`);
              });
              notification(marco).then(n => {
                expect(n.title).to.eq('New trip proposal');
                expect(n.body).to.eq(`${USERS.admin.name} proposes «${title}»: vote!`);
              });
              cy.wait(1000);
              rawPushes(author).should('have.length', 0);
              rawPushes(sofia).should('have.length', 1);
            });
          });
        });
      });
    });
  });

  it('proposta approvata per maggioranza: una sola push a tutti i membri, con il link al viaggio', () => {
    const name = uniq('E2E Push approvata');
    const title = uniq('Barcellona');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode);
      cy.joinGroup('marco', group.inviteCode);
      // Proposta di Sofia: Alessandro e Marco ricevono la proposta (1 push), Sofia no.
      propose('sofia', name, title).then(trip => {
        // I dispositivi si abbonano dopo l'invio (asincrono) della proposta: qui conta solo l'approvazione.
        cy.wait(1500);
        subscribeDevice('admin', { prefix: 'appr-admin' }).then(admin => {
          subscribeDevice('sofia', { prefix: 'appr-sofia' }).then(sofia => {
            subscribeDevice('marco', { prefix: 'appr-marco' }).then(marco => {
              // 1 voto su 3: nessuna maggioranza, nessuna push.
              cy.api('admin', 'POST', `/api/v1/trips/${trip.id}/vote`, { voted: true }).its('decision').should('eq', 'proposal');
              expectNoPush(sofia);

              // 2 voti su 3: confermato.
              cy.api('marco', 'POST', `/api/v1/trips/${trip.id}/vote`, { voted: true }).its('decision').should('eq', 'confirmed');
              [admin, sofia, marco].forEach(device =>
                notification(device).then(n => {
                  expect(n.title).to.eq('Viaggio scelto');
                  expect(n.body).to.eq(`«${title}» è stato scelto dal gruppo 🎉`);
                  // Stesso tag della proposta: la notifica "vota!" viene sostituita.
                  expect(n.tag).to.eq(`proposal:${trip.id}`);
                  expectOpens(n, `/trips/${trip.id}`);
                }),
              );

              // Il viaggio è confermato: altri voti vengono rifiutati e non inviano altro.
              cy.apiToken('sofia').then(token =>
                cy.request({
                  method: 'POST', url: `/api/v1/trips/${trip.id}/vote`, body: { voted: true },
                  failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` },
                }).its('status').should('eq', 409),
              );
              cy.wait(1000);
              [admin, sofia, marco].forEach(device => rawPushes(device).should('have.length', 1));
            });
          });
        });
      });
    });
  });

  it('preferenza "Proposte e voti" disattivata e gruppo silenziato: nessuna push; gli altri la ricevono', () => {
    const name = uniq('E2E Push proposta filtri');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode);
      cy.joinGroup('marco', group.inviteCode);
      cy.joinGroup('giulia', group.inviteCode);
      cy.api('sofia', 'PUT', '/api/v1/push/preferences', { proposals: false });
      cy.api('marco', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true });
      subscribeDevice('sofia', { prefix: 'prop-off' }).then(sofia => {
        subscribeDevice('marco', { prefix: 'prop-muted' }).then(marco => {
          subscribeDevice('giulia', { prefix: 'prop-on' }).then(giulia => {
            propose('admin', name, uniq('Lisbona')).then(trip => {
              notification(giulia).its('tag').should('eq', `proposal:${trip.id}`);
              expectNoPush(sofia);
              rawPushes(marco).should('have.length', 0);
            });
          });
        });
      });
    });
  });

  it('nuovo membro: push solo a chi ha attivato "Nuovi membri", non al nuovo arrivato né all\'admin che approva', () => {
    const name = uniq('E2E Push nuovo membro');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('sofia', group.inviteCode);
      cy.joinGroup('giulia', group.inviteCode);
      // Giulia e Alessandro attivano la categoria; Sofia resta con il default (disattivata).
      cy.api('giulia', 'PUT', '/api/v1/push/preferences', { newMembers: true });
      cy.api('admin', 'PUT', '/api/v1/push/preferences', { newMembers: true });
      subscribeDevice('admin', { prefix: 'nm-admin' }).then(admin => {
        subscribeDevice('sofia', { prefix: 'nm-sofia' }).then(sofia => {
          subscribeDevice('giulia', { prefix: 'nm-giulia' }).then(giulia => {
            subscribeDevice('luca', { prefix: 'nm-luca' }).then(luca => {
              // Ingresso con richiesta approvata dall'admin.
              cy.api<any>('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`).then(request => {
                // L'admin riceve la richiesta (categoria "Inviti e richieste").
                notification(admin).its('tag').should('eq', `join-request:${group.id}`);
                cy.api('admin', 'POST', `/api/v1/groups/${group.id}/join-requests/${request.id}/approve`);
              });
              notification(giulia).then(n => {
                expect(n.title).to.eq('Nuovo membro');
                expect(n.body).to.eq(`${USERS.luca.name} è entrato in «${name}»`);
                expect(n.tag).to.eq(`new-member:${group.id}`);
                expectOpens(n, `/groups/${group.id}`);
              });
              // Luca riceve solo l'esito della sua richiesta.
              notification(luca).its('tag').should('eq', `join-decision:${group.id}`);
              cy.wait(1000);
              rawPushes(sofia).should('have.length', 0);
              rawPushes(admin).should('have.length', 1);
              rawPushes(luca).should('have.length', 1);

              // Ingresso accettando un invito diretto: avvisati anche gli admin con la categoria attiva.
              cy.me('marco').then(marco => {
                cy.api('admin', 'POST', '/api/v1/notifications', { groupId: group.id, recipientId: marco.id });
              });
              cy.apiUntil<any[]>('marco', '/api/v1/notifications', list => {
                expect(list.some(n => n.type === 'group_invite' && n.groupId === group.id && n.status !== 'accepted')).to.be.true;
              }).then(list => {
                const invite = list.find(n => n.type === 'group_invite' && n.groupId === group.id);
                cy.api('marco', 'PUT', `/api/v1/notifications/${invite.id}/accept`);
              });
              notification(giulia, 1).its('body').should('eq', `${USERS.marco.name} è entrato in «${name}»`);
              notification(admin, 1).its('body').should('eq', `${USERS.marco.name} è entrato in «${name}»`);
              cy.wait(1000);
              rawPushes(sofia).should('have.length', 0);
            });
          });
        });
      });
    });
  });
});

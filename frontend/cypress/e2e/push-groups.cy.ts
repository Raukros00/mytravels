import { uniq } from '../support/e2e';
import { PushDevice, expectNoPush, rawPushes, receivedPushes, subscribeDevice } from '../support/push';
import { USERS } from '../support/users';

/**
 * Push per inviti e richieste di ingresso ai gruppi (#96), verificate sul finto push service:
 * destinatario, testo, link e tag; nessuna push a chi ha silenziato il gruppo né all'autore.
 */

/** Notifica (decifrata) ricevuta dal dispositivo, la `index`-esima. */
function notification(device: PushDevice, index = 0) {
  return receivedPushes(device, index + 1).then(list => list[index].payload.notification);
}

const expectOpens = (n: any, url: string) => {
  expect(n.data.url).to.eq(url);
  expect(n.data.onActionClick.default).to.deep.equal({ operation: 'navigateLastFocusedOrOpen', url });
};

describe('Notifiche push – inviti e richieste di ingresso', () => {
  it('invito in un gruppo: push all\'invitato (nella lingua del suo dispositivo), non a chi invita', () => {
    const name = uniq('E2E Push invito');
    cy.createGroup('admin', name).then(group => {
      subscribeDevice('admin', { prefix: 'inviter' }).then(inviter => {
        subscribeDevice('luca', { prefix: 'invited-it' }).then(lucaIt => {
          subscribeDevice('luca', { prefix: 'invited-en', lang: 'en' }).then(lucaEn => {
            cy.me('luca').then(luca => {
              cy.api('admin', 'POST', '/api/v1/notifications', { groupId: group.id, recipientId: luca.id });
              // Invito già in attesa: nessuna seconda push.
              cy.api('admin', 'POST', '/api/v1/notifications', { groupId: group.id, recipientId: luca.id });
            });

            notification(lucaIt).then(n => {
              expect(n.title).to.eq('Nuovo invito');
              expect(n.body).to.eq(`${USERS.admin.name} ti ha invitato in «${name}»`);
              expect(n.tag).to.eq(`invite:${group.id}`);
              expectOpens(n, '/groups');
            });
            notification(lucaEn).then(n => {
              expect(n.title).to.eq('New invitation');
              expect(n.body).to.eq(`${USERS.admin.name} invited you to «${name}»`);
            });
            cy.wait(1000);
            rawPushes(lucaIt).should('have.length', 1);
            rawPushes(inviter).should('have.length', 0);
          });
        });
      });
    });
  });

  it('richiesta di ingresso: push a tutti gli admin; accettata: push solo al richiedente', () => {
    const name = uniq('E2E Push richiesta');
    cy.createGroup('admin', name).then(group => {
      // Sofia entra e diventa admin: anche lei deve ricevere le richieste.
      cy.joinGroup('sofia', group.inviteCode);
      cy.me('sofia').then(sofia => {
        cy.api('admin', 'PUT', `/api/v1/groups/${group.id}/members/${sofia.id}/role`, { role: 'admin' });
      });
      subscribeDevice('admin', { prefix: 'admin' }).then(admin => {
        subscribeDevice('sofia', { prefix: 'coadmin' }).then(coadmin => {
          subscribeDevice('marco', { prefix: 'requester' }).then(requester => {
            cy.api<any>('marco', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`).then(request => {
              [admin, coadmin].forEach(device =>
                notification(device).then(n => {
                  expect(n.title).to.eq('Richiesta di ingresso');
                  expect(n.body).to.eq(`${USERS.marco.name} chiede di entrare in «${name}»`);
                  expect(n.tag).to.eq(`join-request:${group.id}`);
                  expectOpens(n, `/groups/${group.id}`);
                }),
              );
              // Chi chiede di entrare non riceve la propria richiesta.
              rawPushes(requester).should('have.length', 0);

              cy.api('admin', 'POST', `/api/v1/groups/${group.id}/join-requests/${request.id}/approve`);
              notification(requester).then(n => {
                expect(n.title).to.eq('Richiesta accettata');
                expect(n.body).to.eq(`Sei entrato in «${name}»`);
                expect(n.tag).to.eq(`join-decision:${group.id}`);
                expectOpens(n, `/groups/${group.id}`);
              });
              // L'admin che ha deciso (e l'altro admin) non ricevono altro.
              cy.wait(1000);
              rawPushes(admin).should('have.length', 1);
              rawPushes(coadmin).should('have.length', 1);
            });
          });
        });
      });
    });
  });

  it('richiesta rifiutata: push al richiedente con il link ai gruppi', () => {
    const name = uniq('E2E Push rifiuto');
    cy.createGroup('admin', name).then(group => {
      subscribeDevice('giulia', { prefix: 'declined' }).then(requester => {
        cy.api<any>('giulia', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`).then(request => {
          cy.api('admin', 'POST', `/api/v1/groups/${group.id}/join-requests/${request.id}/decline`);
          notification(requester).then(n => {
            expect(n.title).to.eq('Richiesta non accettata');
            expect(n.body).to.eq(`La tua richiesta per «${name}» non è stata accettata`);
            expect(n.tag).to.eq(`join-decision:${group.id}`);
            expectOpens(n, '/groups');
          });
        });
      });
    });
  });

  it('nessuna push per i gruppi silenziati', () => {
    const name = uniq('E2E Push silenziato');
    cy.createGroup('admin', name).then(group => {
      cy.api('admin', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true });
      subscribeDevice('admin', { prefix: 'muted-admin' }).then(admin => {
        subscribeDevice('luca', { prefix: 'muted-requester' }).then(requester => {
          cy.api<any>('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`).then(request => {
            // La notifica nella campanella c'è comunque, la push no.
            cy.apiUntil<any[]>('admin', '/api/v1/notifications', list => {
              expect(list.some(n => n.type === 'join_request' && n.requestId === request.id)).to.be.true;
            });
            expectNoPush(admin);

            // Il silenzio vale solo per chi l'ha attivato: il richiedente riceve l'esito.
            cy.api('admin', 'POST', `/api/v1/groups/${group.id}/join-requests/${request.id}/approve`);
            notification(requester).its('title').should('eq', 'Richiesta accettata');
          });
        });
      });
    });
  });
});

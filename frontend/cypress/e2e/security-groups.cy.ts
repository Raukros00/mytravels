import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(user: 'admin' | 'sofia' | 'marco' | 'luca', method: string, url: string, body?: unknown) {
  return cy.apiToken(user).then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

describe('Sicurezza – accesso ai gruppi', () => {
  it('l\'elenco contiene solo i gruppi di cui si è membri', () => {
    cy.me('admin').then(me => {
      cy.api<any[]>('admin', 'GET', '/api/v1/groups').then(groups => {
        expect(groups.map(g => g.name)).to.include.members([GROUPS.esploratori, GROUPS.warriors]);
        expect(groups.map(g => g.name)).not.to.include(GROUPS.foodies);
        groups.forEach(g => expect(g.members.map((m: any) => m.id), g.name).to.include(me.id));
      });
    });
  });

  it('un gruppo di cui non si è membri risponde 404 (lettura e modifica)', () => {
    cy.groupByName('marco', GROUPS.foodies).then(foodies => {
      rawApi('admin', 'GET', `/api/v1/groups/${foodies.id}`).its('status').should('eq', 404);
      rawApi('admin', 'PUT', `/api/v1/groups/${foodies.id}`, { name: 'Rubato' }).its('status').should('eq', 404);
      rawApi('admin', 'DELETE', `/api/v1/groups/${foodies.id}`).its('status').should('eq', 404);
      rawApi('admin', 'POST', `/api/v1/groups/${foodies.id}/mute`).its('status').should('eq', 404);
      cy.api('marco', 'GET', `/api/v1/groups/${foodies.id}`).its('name').should('eq', GROUPS.foodies);
    });
  });

  it('non si possono leggere i gruppi di un altro utente', () => {
    cy.me('marco').then(marco => {
      rawApi('admin', 'GET', `/api/v1/groups/user/${marco.id}`).its('status').should('eq', 403);
    });
    cy.me('admin').then(admin => {
      rawApi('admin', 'GET', `/api/v1/groups/user/${admin.id}`).its('status').should('eq', 200);
    });
  });

  it('un membro non admin non può eliminare il gruppo né cambiare ruoli o rimuovere altri', () => {
    const name = uniq('E2E Permessi');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      cy.joinGroup('sofia', group.inviteCode);
      cy.me('sofia').then(sofia => {
        rawApi('luca', 'DELETE', `/api/v1/groups/${group.id}`).its('status').should('eq', 403);
        rawApi('luca', 'PUT', `/api/v1/groups/${group.id}/members/${sofia.id}/role`, { role: 'admin' }).its('status').should('eq', 403);
        rawApi('luca', 'DELETE', `/api/v1/groups/${group.id}/members/${sofia.id}`).its('status').should('eq', 403);
      });
      // ...ma può lasciare il gruppo
      cy.me('luca').then(luca => {
        rawApi('luca', 'DELETE', `/api/v1/groups/${group.id}/members/${luca.id}`).its('status').should('eq', 200);
      });
      cy.api<any>('admin', 'GET', `/api/v1/groups/${group.id}`).its('members').should('have.length', 2);
    });
  });

  it('la richiesta di accesso è sempre dell\'utente autenticato e il join diretto non esiste più', () => {
    const name = uniq('E2E Join forzato');
    cy.createGroup('marco', name).then(group => {
      cy.me('sofia').then(sofia => {
        cy.me('luca').then(luca => {
          // luca prova a far entrare sofia passando il suo id: la richiesta resta di luca.
          cy.api<any>('luca', 'POST', `/api/v1/groups/invite/${group.inviteCode}/request`, { userId: sofia.id }).then(r => {
            expect(r.userId).to.eq(luca.id);
            expect(r.status).to.eq('pending');
          });
          // Senza approvazione non è membro.
          cy.api<any>('marco', 'GET', `/api/v1/groups/${group.id}`).its('members').should('have.length', 1);
          // L'ingresso diretto non esiste più (404/405 a seconda del routing) e non rende membri.
          rawApi('luca', 'POST', '/api/v1/groups/join', { inviteCode: group.inviteCode }).its('status').should('be.oneOf', [404, 405]);
          cy.api<any>('marco', 'GET', `/api/v1/groups/${group.id}`).its('members').should('have.length', 1);
        });
      });
    });
  });

  it('il creatore indicato nel body viene ignorato: il gruppo è dell\'utente autenticato', () => {
    cy.me('marco').then(marco => {
      cy.api<any>('admin', 'POST', '/api/v1/groups', { name: uniq('E2E Creatore'), creatorId: marco.id }).then(group => {
        cy.me('admin').then(admin => {
          expect(group.creatorId).to.eq(admin.id);
          expect(group.members.map((m: any) => m.id)).to.deep.eq([admin.id]);
        });
      });
    });
  });
});

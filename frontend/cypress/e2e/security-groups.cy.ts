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

  it('solo un admin può modificare il gruppo: un membro riceve 403 e il gruppo non cambia', () => {
    const name = uniq('E2E Modifica');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      rawApi('luca', 'PUT', `/api/v1/groups/${group.id}`, { name: 'Rubato' }).its('status').should('eq', 403);
      rawApi('luca', 'PUT', `/api/v1/groups/${group.id}`, { archived: true }).its('status').should('eq', 403);
      rawApi('luca', 'PUT', `/api/v1/groups/${group.id}`, { currency: 'USD' }).its('status').should('eq', 403);
      cy.api<any>('admin', 'GET', `/api/v1/groups/${group.id}`).then(g => {
        expect(g.name).to.eq(name);
        expect(g.archived).to.eq(false);
        expect(g.currency).to.eq('EUR');
      });
      // L'admin invece può.
      rawApi('admin', 'PUT', `/api/v1/groups/${group.id}`, { description: 'Aggiornata' }).then(res => {
        expect(res.status).to.eq(200);
        expect(res.body.description).to.eq('Aggiornata');
      });
    });
  });

  it('le notifiche silenziate degli altri non si cambiano: PUT ignora mutedBy, /mute tocca solo sé stessi', () => {
    const name = uniq('E2E Muted');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      cy.me('luca').then(luca => {
        cy.me('admin').then(admin => {
          // luca silenzia il gruppo per sé.
          cy.api<any>('luca', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true })
            .its('mutedBy').should('deep.eq', [luca.id]);
          // L'admin prova a sovrascrivere mutedBy via PUT: il campo viene ignorato.
          rawApi('admin', 'PUT', `/api/v1/groups/${group.id}`, { mutedBy: [admin.id] }).its('status').should('eq', 200);
          cy.api<any>('admin', 'GET', `/api/v1/groups/${group.id}`).its('mutedBy').should('deep.eq', [luca.id]);
          // /mute dell'admin non tocca lo stato di luca; muted esplicito è idempotente.
          cy.api<any>('admin', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true })
            .its('mutedBy').should('have.members', [luca.id, admin.id]);
          cy.api<any>('admin', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: true })
            .its('mutedBy').should('have.length', 2);
          cy.api<any>('admin', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: false })
            .its('mutedBy').should('deep.eq', [luca.id]);
          rawApi('admin', 'POST', `/api/v1/groups/${group.id}/mute`, { muted: 'si' }).its('status').should('eq', 400);
        });
      });
    });
  });

  it('icona del gruppo: emoji e immagini piccole sì; URL, formati non validi e immagini enormi no (400)', () => {
    const name = uniq('E2E Icona');
    const smallPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    cy.createGroup('admin', name).then(group => {
      const put = (icon: string) => rawApi('admin', 'PUT', `/api/v1/groups/${group.id}`, { icon });
      put('🏖️').its('status').should('eq', 200);
      put(smallPng).its('status').should('eq', 200);
      put('https://evil.example/pixel.gif').its('status').should('eq', 400);
      put('data:text/html;base64,PHNjcmlwdD4=').its('status').should('eq', 400);
      put('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=').its('status').should('eq', 400);
      put('data:image/jpeg;base64,' + 'A'.repeat(500_000)).its('status').should('eq', 400);
      put('questa non è una emoji').its('status').should('eq', 400);
      cy.api<any>('admin', 'GET', `/api/v1/groups/${group.id}`).its('icon').should('eq', smallPng);
    });
    // Anche in creazione.
    rawApi('admin', 'POST', '/api/v1/groups', { name: uniq('E2E Icona URL'), icon: 'http://x.y/z.png' })
      .its('status').should('eq', 400);
  });

  it('l\'ultimo admin non può uscire né declassarsi finché ci sono altri membri (409)', () => {
    const name = uniq('E2E Ultimo admin');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      cy.me('admin').then(admin => {
        rawApi('admin', 'DELETE', `/api/v1/groups/${group.id}/members/${admin.id}`).then(res => {
          expect(res.status).to.eq(409);
          expect(res.body.message).to.contain('nomina prima un altro amministratore');
        });
        rawApi('admin', 'PUT', `/api/v1/groups/${group.id}/members/${admin.id}/role`, { role: 'member' }).then(res => {
          expect(res.status).to.eq(409);
          expect(res.body.message).to.contain('nomina prima un altro amministratore');
        });
        cy.api<any>('admin', 'GET', `/api/v1/groups/${group.id}`).then(g => {
          expect(g.members.find((m: any) => m.id === admin.id).role).to.eq('admin');
        });

        // Dopo aver nominato un altro admin può declassarsi e uscire.
        cy.me('luca').then(luca => {
          cy.api('admin', 'PUT', `/api/v1/groups/${group.id}/members/${luca.id}/role`, { role: 'admin' });
          rawApi('admin', 'PUT', `/api/v1/groups/${group.id}/members/${admin.id}/role`, { role: 'member' })
            .its('status').should('eq', 200);
          // Ora l'unico admin è luca: l'ex admin (membro) può uscire.
          rawApi('admin', 'DELETE', `/api/v1/groups/${group.id}/members/${admin.id}`).its('status').should('eq', 200);
          cy.api<any>('luca', 'GET', `/api/v1/groups/${group.id}`).its('members').then((members: any[]) => {
            expect(members.map(m => m.id)).to.deep.eq([luca.id]);
            expect(members[0].role).to.eq('admin');
          });
        });
      });
    });
  });

  it('sono ammessi solo i ruoli admin e member (400 negli altri casi)', () => {
    const name = uniq('E2E Ruoli');
    cy.createGroup('admin', name).then(group => {
      cy.joinGroup('luca', group.inviteCode);
      cy.me('luca').then(luca => {
        const setRole = (role: unknown) =>
          rawApi('admin', 'PUT', `/api/v1/groups/${group.id}/members/${luca.id}/role`, { role });
        setRole('pippo').its('status').should('eq', 400);
        setRole('owner').its('status').should('eq', 400);
        setRole('').its('status').should('eq', 400);
        cy.api<any>('admin', 'GET', `/api/v1/groups/${group.id}`).then(g => {
          expect(g.members.find((m: any) => m.id === luca.id).role).to.eq('member');
        });
        setRole('admin').its('status').should('eq', 200);
        setRole('member').its('status').should('eq', 200);
        // Membro inesistente: 404.
        rawApi('admin', 'PUT', `/api/v1/groups/${group.id}/members/non-esiste/role`, { role: 'admin' })
          .its('status').should('eq', 404);
      });
    });
  });

  it('se esce l\'ultimo membro il gruppo viene eliminato', () => {
    const name = uniq('E2E Ultimo membro API');
    cy.createGroup('admin', name).then(group => {
      cy.me('admin').then(admin => {
        rawApi('admin', 'DELETE', `/api/v1/groups/${group.id}/members/${admin.id}`).then(res => {
          expect(res.status).to.eq(200);
          expect(res.body.groupDeleted).to.eq(true);
        });
        rawApi('admin', 'GET', `/api/v1/groups/${group.id}`).its('status').should('eq', 404);
        cy.api<any[]>('admin', 'GET', '/api/v1/groups').then(groups => {
          expect(groups.map(g => g.id)).not.to.include(group.id);
        });
      });
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

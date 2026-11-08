import { uniq } from '../support/e2e';
import { DemoUser } from '../support/users';

/**
 * Accesso ai viaggi (#76): solo i membri del gruppo del viaggio lo leggono e lo modificano
 * (per gli altri non esiste: 404); eliminarlo spetta agli admin del gruppo (403 per i membri).
 */

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(user: DemoUser, method: Method, url: string, body?: unknown) {
  return cy.apiToken(user).then(token =>
    cy.request({ method, url, body: body as Cypress.RequestBody, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

function tripBody(groupId: string, overrides: Record<string, unknown> = {}) {
  return {
    groupId, title: uniq('E2E Viaggio privato'), destination: 'Genova', country: 'Italia',
    startDate: '2027-09-01', endDate: '2027-09-04', decision: 'confirmed', notes: 'Note originali',
    ...overrides,
  };
}

/**
 * Gruppo di admin con luca (membro non admin), con un viaggio che ha un'attività, un locale e
 * una spesa. giulia e marco non ne fanno parte.
 */
function privateTrip() {
  return cy.createGroup('admin', uniq('E2E Gruppo privato')).then(group => {
    cy.joinGroup('luca', group.inviteCode);
    return cy.api<any>('admin', 'POST', '/api/v1/trips', tripBody(group.id)).then(trip =>
      cy.me('admin').then(admin =>
        cy.api<any>('admin', 'POST', `/api/v1/trips/${trip.id}/activities`, { name: 'Acquario', category: 'museum' }).then(activity =>
          cy.api<any>('admin', 'POST', `/api/v1/trips/${trip.id}/places-to-eat`, { name: 'Trattoria', category: 'dinner' }).then(place =>
            cy.api<any>('admin', 'POST', `/api/v1/trips/${trip.id}/expenses`, {
              title: 'Focaccia', amount: 8, paidBy: admin.id, splitAmong: [admin.id], shares: { [admin.id]: 8 },
              type: 'expense', category: 'food', date: '2027-09-01',
            }).then(expense => ({ group, trip, activity, place, expense })),
          ),
        ),
      ),
    );
  });
}

describe('Sicurezza – accesso ai viaggi', () => {
  it('chi non è nel gruppo riceve 404 su viaggio e sotto-risorse, e non cambia nulla', () => {
    privateTrip().then(({ group, trip, activity, place, expense }) => {
      const base = `/api/v1/trips/${trip.id}`;
      const calls: [Method, string, unknown?][] = [
        ['GET', base],
        ['PUT', base, { title: 'Rubato', notes: 'Rubate' }],
        ['DELETE', base],
        ['GET', `/api/v1/trips/group/${group.id}`],
        ['POST', `${base}/activities`, { name: 'Intrusa' }],
        ['PUT', `${base}/activities/${activity.id}`, { name: 'Modificata' }],
        ['DELETE', `${base}/activities/${activity.id}`],
        ['POST', `${base}/places-to-eat`, { name: 'Intruso' }],
        ['PUT', `${base}/places-to-eat/${place.id}`, { name: 'Modificato' }],
        ['DELETE', `${base}/places-to-eat/${place.id}`],
        ['PUT', `${base}/flights`, {}],
        ['PUT', `${base}/transfers`, {}],
        ['PUT', `${base}/accommodation`, { name: 'Hotel Rubato' }],
        ['GET', `${base}/expenses`],
        ['POST', `${base}/expenses`, { title: 'Intrusa', amount: 1 }],
        ['PUT', `${base}/expenses/${expense.id}`, { title: 'Modificata', amount: 999 }],
        ['DELETE', `${base}/expenses/${expense.id}`],
        ['POST', `${base}/vote`, {}],
      ];
      calls.forEach(([method, url, body]) =>
        rawApi('giulia', method, url, body).its('status').should('eq', 404, `${method} ${url}`),
      );

      // Il viaggio è intatto.
      cy.api<any>('admin', 'GET', base).then(saved => {
        expect(saved.title).to.eq(trip.title);
        expect(saved.notes).to.eq('Note originali');
        expect(saved.accommodation?.name ?? null).to.eq(null);
        expect(saved.activities.map((a: any) => a.name)).to.deep.eq(['Acquario']);
        expect(saved.placesToEat.map((p: any) => p.name)).to.deep.eq(['Trattoria']);
      });
      cy.api<any[]>('admin', 'GET', `${base}/expenses`).then(expenses => {
        expect(expenses.map(e => [e.title, e.amount])).to.deep.eq([['Focaccia', 8]]);
      });
    });
  });

  it('l\'elenco dei viaggi contiene solo quelli dei propri gruppi', () => {
    privateTrip().then(({ trip }) => {
      cy.api<any[]>('giulia', 'GET', '/api/v1/trips').then(trips => {
        expect(trips.map(t => t.id)).not.to.include(trip.id);
      });
      cy.api<any[]>('luca', 'GET', '/api/v1/trips').then(trips => {
        expect(trips.map(t => t.id)).to.include(trip.id);
      });
    });
  });

  it('non si creano viaggi nei gruppi altrui; autore e voti li decide il server', () => {
    privateTrip().then(({ group }) => {
      rawApi('giulia', 'POST', '/api/v1/trips', tripBody(group.id, { title: 'Intruso' })).its('status').should('eq', 404);
      cy.api<any[]>('admin', 'GET', `/api/v1/trips/group/${group.id}`).then(trips => {
        expect(trips.map(t => t.title)).not.to.include('Intruso');
      });

      // luca (membro) propone indicando admin come autore e un voto già dato: ignorati.
      cy.me('admin').then(admin => cy.me('luca').then(luca => {
        cy.api<any>('luca', 'POST', '/api/v1/trips', tripBody(group.id, {
          decision: 'proposal', proposedBy: admin.id, votes: [admin.id, luca.id],
        })).then(proposal => {
          expect(proposal.proposedBy).to.eq(luca.id);
          expect(proposal.votes).to.deep.eq([]);
          expect(proposal.decision).to.eq('proposal');
        });
      }));
    });
  });

  it('un membro legge e modifica il viaggio; solo un admin lo elimina (403 per gli altri)', () => {
    privateTrip().then(({ trip, activity }) => {
      const base = `/api/v1/trips/${trip.id}`;
      cy.api<any>('luca', 'GET', base).its('title').should('eq', trip.title);
      cy.api<any>('luca', 'PUT', base, { notes: 'Note di Luca' }).its('notes').should('eq', 'Note di Luca');
      cy.api<any>('luca', 'PUT', `${base}/activities/${activity.id}`, { name: 'Acquario di Genova', category: 'museum' })
        .its('name').should('eq', 'Acquario di Genova');
      cy.api<any>('luca', 'POST', `${base}/activities`, { name: 'Lanterna', category: 'monument' })
        .its('tripId').should('eq', trip.id);
      cy.api<any[]>('luca', 'GET', `${base}/expenses`).should('have.length', 1);

      rawApi('luca', 'DELETE', base).then(res => {
        expect(res.status).to.eq(403);
        expect(res.body.message).to.contain('amministratori');
      });
      cy.api<any>('admin', 'GET', base).its('id').should('eq', trip.id);

      rawApi('admin', 'DELETE', base).its('status').should('eq', 200);
      rawApi('admin', 'GET', base).its('status').should('eq', 404);
    });
  });

  it('attività, locali e spese non si spostano tra viaggi usando il loro id', () => {
    privateTrip().then(({ trip, activity, place, expense }) => {
      // giulia ha un suo gruppo con un suo viaggio.
      cy.createGroup('giulia', uniq('E2E Gruppo di Giulia')).then(other => {
        cy.api<any>('giulia', 'POST', '/api/v1/trips', tripBody(other.id)).then(own => {
          const ownBase = `/api/v1/trips/${own.id}`;

          // Creazione con l'id di un elemento altrui: l'id viene ignorato, ne nasce uno nuovo.
          cy.api<any>('giulia', 'POST', `${ownBase}/activities`, { id: activity.id, name: 'Presa' }).then(created => {
            expect(created.id).not.to.eq(activity.id);
            expect(created.tripId).to.eq(own.id);
          });
          cy.api<any>('giulia', 'POST', `${ownBase}/places-to-eat`, { id: place.id, name: 'Preso' })
            .its('id').should('not.eq', place.id);
          cy.api<any>('giulia', 'POST', `${ownBase}/expenses`, { id: expense.id, title: 'Presa', amount: 1 })
            .its('id').should('not.eq', expense.id);

          // Modifica tramite il proprio viaggio: l'elemento non è di quel viaggio.
          rawApi('giulia', 'PUT', `${ownBase}/activities/${activity.id}`, { name: 'Presa' }).its('status').should('eq', 404);
          rawApi('giulia', 'PUT', `${ownBase}/expenses/${expense.id}`, { title: 'Presa', amount: 1 }).its('status').should('eq', 404);
          rawApi('giulia', 'DELETE', `${ownBase}/places-to-eat/${place.id}`).its('status').should('eq', 404);

          // Liste nel PUT del viaggio: gli id altrui vengono sostituiti.
          rawApi('giulia', 'PUT', ownBase, {
            activities: [{ id: activity.id, name: 'Presa col PUT' }],
            placesToEat: [{ id: place.id, name: 'Preso col PUT' }],
            expenses: [{ id: expense.id, title: 'Presa col PUT', amount: 1 }],
          }).then(res => {
            expect(res.status).to.eq(200);
            expect(res.body.activities.map((a: any) => a.id)).not.to.include(activity.id);
            expect(res.body.placesToEat.map((p: any) => p.id)).not.to.include(place.id);
            expect(res.body.expenses.map((e: any) => e.id)).not.to.include(expense.id);
          });

          // Il viaggio di admin ha ancora tutto, invariato.
          cy.api<any>('admin', 'GET', `/api/v1/trips/${trip.id}`).then(saved => {
            expect(saved.activities.map((a: any) => [a.id, a.name])).to.deep.eq([[activity.id, 'Acquario']]);
            expect(saved.placesToEat.map((p: any) => [p.id, p.name])).to.deep.eq([[place.id, 'Trattoria']]);
          });
          cy.api<any[]>('admin', 'GET', `/api/v1/trips/${trip.id}/expenses`).then(expenses => {
            expect(expenses.map(e => [e.id, e.title, e.amount])).to.deep.eq([[expense.id, 'Focaccia', 8]]);
          });
        });
      });
    });
  });

  it('interfaccia: "Elimina viaggio" solo per gli admin del gruppo; un 403 mostra un messaggio', () => {
    privateTrip().then(({ trip }) => {
      // luca è membro non admin: vede il viaggio ma non il menu per eliminarlo.
      cy.login('luca');
      cy.visit('/trips');
      cy.contains('.trip-card', trip.title).should('be.visible').find('.card-menu-btn').should('not.exist');

      // admin vede il menu; se il server rifiuta (es. ruolo cambiato nel frattempo) il viaggio resta.
      cy.login('admin');
      cy.visit('/trips');
      cy.intercept('DELETE', `/api/v1/trips/${trip.id}`, {
        statusCode: 403,
        body: { error: 'Forbidden', message: 'Solo gli amministratori del gruppo possono eliminare il viaggio' },
      }).as('delete');
      cy.on('window:confirm', () => true);
      cy.contains('.trip-card', trip.title).find('.card-menu-btn').click();
      cy.contains('.trip-card', trip.title).contains('button', 'Elimina viaggio').click();
      cy.wait('@delete');
      cy.toast('Solo gli amministratori del gruppo possono eliminare il viaggio').should('be.visible');
      cy.contains('.trip-card', trip.title).should('be.visible');
    });
  });
});

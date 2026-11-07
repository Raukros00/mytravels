import i18n from '../../public/i18n/it.json';
import { uniq } from '../support/e2e';
import { DemoUser } from '../support/users';

const t = i18n.groups;

/**
 * Modifiche contemporanee allo stesso viaggio (#79): il secondo utente agisce via API mentre
 * l'interfaccia del primo è aperta con una copia ormai superata. Nessuna modifica deve andare
 * persa, i voti contano tutti e la conferma della proposta la decide il server.
 */

/** Gruppo creato da admin con i membri indicati, e una proposta da votare al suo interno. */
function groupWithProposal(members: DemoUser[], title: string) {
  return cy.createGroup('admin', uniq('E2E Concorrenza')).then(group => {
    members.forEach(m => cy.joinGroup(m, group.inviteCode));
    return cy.api('sofia', 'POST', '/api/v1/trips', {
      groupId: group.id, title, destination: 'Cagliari', country: 'Italia',
      startDate: '2027-08-01', endDate: '2027-08-05', decision: 'proposal', votes: [],
    }).then(proposal => ({ group, proposal }));
  });
}

/** Richiesta autenticata che non fallisce sugli errori: per verificare i codici di risposta. */
function rawApi(user: DemoUser, method: 'POST' | 'PUT', url: string, body?: Cypress.RequestBody) {
  return cy.apiToken(user).then(token => cy.request({
    method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` },
  }));
}

const vote = (user: DemoUser, tripId: string, body: unknown = {}) =>
  cy.api(user, 'POST', `/api/v1/trips/${tripId}/vote`, body);

describe('Viaggi – voto sul server', () => {
  it('il voto vale per l\'utente autenticato, solo per i membri e solo sulle proposte', () => {
    groupWithProposal(['sofia', 'marco'], 'Proposta regole voto').then(({ proposal }) => {
      cy.me('sofia').then(sofia => cy.me('marco').then(marco => {
        // userId nel corpo ignorato: il voto è di chi chiama.
        vote('sofia', proposal.id, { userId: marco.id }).then(trip => {
          expect(trip.votes).to.deep.eq([sofia.id]);
          expect(trip.decision).to.eq('proposal');
        });
        // Con "voted" il voto è idempotente: ripeterlo non lo toglie.
        vote('sofia', proposal.id, { voted: true }).its('votes').should('deep.eq', [sofia.id]);
      }));

      // Chi non è nel gruppo non può votare.
      rawApi('giulia', 'POST', `/api/v1/trips/${proposal.id}/vote`, {}).its('status').should('eq', 403);

      // I voti non si cambiano con il PUT del viaggio.
      rawApi('sofia', 'PUT', `/api/v1/trips/${proposal.id}`, { votes: [] }).its('status').should('eq', 200);
      cy.api('sofia', 'GET', `/api/v1/trips/${proposal.id}`).its('votes').should('have.length', 1);

      // Secondo voto su tre membri: maggioranza, la proposta è confermata dal server.
      vote('marco', proposal.id).its('decision').should('eq', 'confirmed');
      rawApi('admin', 'POST', `/api/v1/trips/${proposal.id}/vote`, {}).its('status').should('eq', 409);
    });
  });

  it('due voti simultanei vengono contati entrambi', () => {
    cy.login('admin');
    cy.visit('/groups');
    // 4 membri: servono 3 voti, quindi dopo i due voti paralleli resta una proposta.
    groupWithProposal(['sofia', 'marco', 'luca'], 'Proposta voti paralleli').then(({ proposal }) => {
      cy.apiToken('sofia').then(sofiaToken => cy.apiToken('marco').then(marcoToken => {
        cy.window().then(win => {
          const post = (token: string) => win.fetch(`/api/v1/trips/${proposal.id}/vote`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ voted: true }),
          }).then(r => r.status);
          return Promise.all([post(sofiaToken), post(marcoToken)]);
        }).should('deep.eq', [200, 200]);
      }));
      cy.api('admin', 'GET', `/api/v1/trips/${proposal.id}`).then(trip => {
        expect(trip.votes).to.have.length(2);
        expect(trip.decision).to.eq('proposal');
      });
    });
  });

  it('contano solo i voti dei membri attuali', () => {
    // 4 membri (servono 3 voti); luca vota e poi esce: restano 3 membri (servono 2 voti).
    groupWithProposal(['sofia', 'marco', 'luca'], 'Proposta ex membro').then(({ group, proposal }) => {
      vote('luca', proposal.id);
      cy.me('luca').then(luca => cy.api('luca', 'DELETE', `/api/v1/groups/${group.id}/members/${luca.id}`));
      // Con il voto di luca sarebbero 2: non deve bastare.
      vote('sofia', proposal.id).its('decision').should('eq', 'proposal');
      vote('marco', proposal.id).its('decision').should('eq', 'confirmed');
    });
  });
});

describe('Viaggi – due sessioni sulla stessa proposta', () => {
  beforeEach(() => cy.login('admin'));

  it('votare da una pagina aperta da prima non cancella le modifiche degli altri', () => {
    // 4 membri: il voto di admin non conferma la proposta.
    groupWithProposal(['sofia', 'marco', 'luca'], 'Proposta modifiche parallele').then(({ group, proposal }) => {
      cy.visit(`/groups/${group.id}`);
      cy.contains('.trip-title', 'Proposta modifiche parallele').should('be.visible');

      // Intanto sofia, da un altro browser, aggiunge un'attività e cambia le note.
      cy.api('sofia', 'POST', `/api/v1/trips/${proposal.id}/activities`, {
        name: 'Spiaggia del Poetto', category: 'nature', isCompleted: false,
      });
      cy.api('sofia', 'PUT', `/api/v1/trips/${proposal.id}`, { notes: 'Note di Sofia' });

      cy.intercept('POST', `/api/v1/trips/${proposal.id}/vote`).as('vote');
      cy.contains('button', t.proposal_vote).click();
      cy.wait('@vote').its('response.statusCode').should('eq', 200);
      cy.contains('button', t.proposal_unvote).should('be.visible');

      cy.me('admin').then(me => cy.apiUntil('admin', `/api/v1/trips/${proposal.id}`, trip => {
        expect(trip.votes).to.deep.eq([me.id]);
        expect(trip.notes).to.eq('Note di Sofia');
        expect(trip.activities.map((a: any) => a.name)).to.deep.eq(['Spiaggia del Poetto']);
      }));
    });
  });

  it('il voto di un altro membro arrivato nel frattempo conta: la proposta è confermata', () => {
    // 3 membri: servono 2 voti.
    groupWithProposal(['sofia', 'marco'], 'Proposta voto quasi simultaneo').then(({ group, proposal }) => {
      cy.visit(`/groups/${group.id}`);
      cy.contains('.trip-title', 'Proposta voto quasi simultaneo').should('be.visible');
      cy.contains('.vote-count', '0 di 2').should('be.visible');

      // Sofia vota da un altro browser: la pagina di admin mostra ancora 0 voti.
      vote('sofia', proposal.id, { voted: true });

      cy.contains('button', t.proposal_vote).click();
      cy.toast('"Proposta voto quasi simultaneo" è stato scelto dal gruppo!').should('be.visible');
      cy.contains('.trip-title', 'Proposta voto quasi simultaneo').should('be.visible');
      cy.contains('.proposals-title', t.proposals_title).should('not.exist');

      cy.api('admin', 'GET', `/api/v1/trips/${proposal.id}`).then(trip => {
        expect(trip.votes).to.have.length(2);
        expect(trip.decision).to.eq('confirmed');
      });
    });
  });
});

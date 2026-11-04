import { uniq } from '../support/e2e';

/** Itinerario del catalogo statico (src/app/core/data/explore-catalog.ts). */
const TEMPLATE = { id: 'tpl_barcellona', title: 'Barcellona tra Gaudí e tapas', destination: 'Barcellona' };

describe('Esplora', () => {
  beforeEach(() => cy.login('admin'));

  describe('catalogo', () => {
    beforeEach(() => {
      cy.visit('/explore');
      cy.contains('h1', 'Esplora').should('be.visible');
    });

    it('mostra le selezioni e "Mostra tutto" apre la griglia completa', () => {
      cy.get('.ex-card').should('have.length.greaterThan', 0);
      cy.contains('button', /Mostra tutto \(\d+\)/).invoke('text').then(text => {
        const total = Number(text.match(/\((\d+)\)/)![1]);
        cy.contains('button', 'Mostra tutto').click();
        cy.contains('.ex-count', `${total} itinerari`).should('be.visible');
        cy.get('.ex-grid .ex-card').should('have.length', total);
        cy.contains('button', 'Torna alle selezioni').click();
        cy.get('.ex-grid').should('not.exist');
      });
    });

    it('la ricerca filtra per destinazione', () => {
      cy.get('input[aria-label="Cerca viaggi"]').type('barcellona');
      cy.get('.ex-grid .ex-card').should('have.length.gte', 1);
      cy.get('.ex-grid .ex-card-title').each($t => expect($t.text().toLowerCase()).to.contain('barcellona'));
    });

    it('senza risultati mostra lo stato vuoto e "Azzera filtri" ripristina', () => {
      cy.get('input[aria-label="Cerca viaggi"]').type('destinazione-inesistente-xyz');
      cy.contains('Nessun itinerario trovato').should('be.visible');
      cy.contains('button', 'Azzera filtri').click();
      cy.get('input[aria-label="Cerca viaggi"]').should('have.value', '');
      cy.get('.ex-card').should('have.length.greaterThan', 0);
    });

    it('un tag attiva il filtro e si può togliere', () => {
      cy.get('[aria-label="Filtra per tag"] .ex-chip').first().as('tag').click();
      cy.get('@tag').should('have.class', 'ex-chip--active');
      cy.get('.ex-grid .ex-card').should('have.length.gte', 1);
      cy.get('@tag').click().should('not.have.class', 'ex-chip--active');
    });

    it('ordinamento e filtri per durata/budget non rompono la lista', () => {
      cy.get('select[aria-label="Ordina per"] option').its('length').should('be.gte', 2);
      cy.get('select[aria-label="Ordina per"]').select(1);
      cy.get('select[aria-label="Durata"]').select(1);
      cy.get('select[aria-label="Budget massimo"]').select(0);
      cy.get('.ex-grid .ex-card, app-empty-state').should('exist');
    });

    it('una card apre il dettaglio dell\'itinerario', () => {
      cy.get('input[aria-label="Cerca viaggi"]').type(TEMPLATE.destination);
      cy.contains('.ex-card', TEMPLATE.title).click();
      cy.location('pathname').should('eq', `/explore/${TEMPLATE.id}`);
    });
  });

  describe('dettaglio', () => {
    it('mostra descrizione e itinerario', () => {
      cy.visit(`/explore/${TEMPLATE.id}`);
      cy.contains('h1.ed-title', TEMPLATE.title).should('be.visible');
      cy.contains('.ed-h2', 'Descrizione').should('be.visible');
      cy.contains('.ed-h2', 'Itinerario').should('be.visible');
      cy.contains('a', 'Esplora').click();
      cy.location('pathname').should('eq', '/explore');
    });

    it('un id inesistente mostra "Itinerario non trovato"', () => {
      cy.visit('/explore/tpl_inesistente');
      cy.contains('Itinerario non trovato').should('be.visible');
    });

    it('assegna l\'itinerario a un gruppo: il viaggio è salvato sul backend con attività e locali', () => {
      const groupName = uniq('E2E Gruppo Esplora');
      cy.createGroup('admin', groupName).then(group => {
        cy.visit(`/explore/${TEMPLATE.id}`);
        cy.contains('button', 'Assegna a un gruppo').click();

        cy.dialog('Assegna a un gruppo').within(() => {
          cy.contains('.am-group', groupName).click().should('have.class', 'am-group--active');
          cy.get('#am-start').clear().type('2027-09-01');
          cy.contains('button', 'Assegna e apri').should('be.enabled').click();
        });

        cy.toast(`"${TEMPLATE.title}" aggiunto al gruppo`).should('be.visible');
        cy.contains('h1', TEMPLATE.title).should('be.visible');
        // L'URL passa all'id definitivo assegnato dal backend.
        cy.location('pathname').should('match', /^\/trips\/[0-9a-f-]{36}$/);

        cy.apiUntil<any[]>('admin', `/api/v1/trips/group/${group.id}`, trips => {
          expect(trips).to.have.length(1);
          expect(trips[0]).to.include({ title: TEMPLATE.title, startDate: '2027-09-01' });
          expect(trips[0].activities.length, 'attività copiate').to.be.greaterThan(0);
          expect(trips[0].placesToEat.length, 'locali copiati').to.be.greaterThan(0);
        });

        // Dopo un reload il viaggio c'è ancora (non era solo nel browser).
        cy.reload();
        cy.contains('h1', TEMPLATE.title).should('be.visible');
      });
    });
  });
});

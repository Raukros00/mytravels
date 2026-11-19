describe('Pagina «Il nostro impatto green» (#168)', () => {
  beforeEach(() => cy.visit('/impatto-green'));

  it('è pubblica: si apre senza account', () => {
    cy.location('pathname').should('eq', '/impatto-green');
    cy.contains('h1', 'Viaggiare insieme, lasciando meno impronta').should('be.visible');
  });

  it('mostra i quattro impegni e la timeline di WanderBite', () => {
    cy.contains('h2', 'I nostri impegni').should('be.visible');
    cy.get('#impegni article').should('have.length', 4);
    cy.contains('h2', 'Come ti aiuta WanderBite').should('be.visible');
    cy.get('.green-timeline li').should('have.length', 3);
  });

  it('non pubblica cifre o stime inventate: gli indicatori sono "in arrivo" o "in validazione"', () => {
    cy.contains('h2', 'Come stiamo andando').should('be.visible');
    cy.contains('Dato in arrivo').should('exist');
    cy.contains('In validazione').should('exist');
    // Nessun numero accanto a unità di emissione
    cy.get('main').invoke('text').should('not.match', /\d+(?:[.,]\d+)?\s?(kg|t|g)\s?(di\s)?CO/i);
  });

  it("l'immagine principale si carica", () => {
    cy.get('img[src$="green-hero.jpg"]')
      .should('be.visible')
      .and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));
  });

  it('la checklist dei piccoli gesti si spunta e si deseleziona', () => {
    cy.get('button[role="checkbox"]').first().should('have.attr', 'aria-checked', 'false').click();
    cy.get('button[role="checkbox"]').first().should('have.attr', 'aria-checked', 'true');
    cy.get('button[role="checkbox"]').first().click().should('have.attr', 'aria-checked', 'false');
  });

  it('i pulsanti "Crea un viaggio" portano alla creazione (con accesso richiesto)', () => {
    cy.get('a[href="/trips/new"]').should('have.length.at.least', 2);
  });

  it('il footer porta alla pagina green', () => {
    cy.get('footer nav[aria-label="Informative"]').contains('a', 'Impatto green').should('have.attr', 'href', '/impatto-green');
  });

  it('è leggibile su mobile senza scorrimento orizzontale', () => {
    cy.viewport(390, 844);
    cy.visit('/impatto-green');
    cy.contains('h1', 'Viaggiare insieme').should('be.visible');
    cy.document().then((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth);
    });
  });
});

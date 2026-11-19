describe('Pagine informative: privacy, termini e cookie (#167)', () => {
  it('la privacy è pubblica: si apre senza account', () => {
    cy.visit('/privacy');
    cy.location('pathname').should('eq', '/privacy');
    cy.contains('h1', 'I tuoi dati, in parole semplici').should('be.visible');
    cy.contains('In breve').should('be.visible');
  });

  it('i dati legali non sono inventati: restano segnaposto da definire', () => {
    cy.visit('/privacy');
    cy.contains('da definire').should('exist');
    cy.contains(/P\.?\s?IVA|REA\s/).should('not.exist');
  });

  it('il selettore passa tra Privacy, Termini e Cookie', () => {
    cy.visit('/privacy');
    cy.get('nav[aria-label="Pagine legali"]').contains('a', "Termini d'uso").click();
    cy.location('pathname').should('eq', '/termini');
    cy.contains('h1', 'Le regole per viaggiare insieme').should('be.visible');

    cy.get('nav[aria-label="Pagine legali"]').contains('a', 'Cookie').click();
    cy.location('pathname').should('eq', '/cookie');
    cy.contains('h1', 'Solo ciò che serve').should('be.visible');
    cy.contains('localStorage').should('be.visible');
  });

  it('il footer porta alle tre pagine', () => {
    cy.visit('/privacy');
    cy.get('footer nav[aria-label="Informative"]').within(() => {
      cy.contains('a', 'Privacy').should('have.attr', 'href', '/privacy');
      cy.contains('a', 'Termini').should('have.attr', 'href', '/termini');
      cy.contains('a', 'Cookie').should('have.attr', 'href', '/cookie');
    });
  });

  it('su desktop tutte le sezioni sono visibili e l\'indice scorre alla sezione', () => {
    cy.viewport(1280, 900);
    cy.visit('/privacy');
    cy.get('#titolare-body').should('be.visible');
    cy.get('#diritti-body').should('be.visible');
    cy.get('aside').contains('button', 'I tuoi diritti').click();
    cy.get('#diritti').should('be.visible');
  });

  it('su mobile è una fisarmonica: si apre solo la prima sezione', () => {
    cy.viewport(390, 844);
    cy.visit('/privacy');
    cy.get('#titolare-body').should('be.visible');
    cy.get('#dati-body').should('not.be.visible');
    cy.get('#dati').find('button').first().click();
    cy.get('#dati-body').should('be.visible');
  });

  it('la privacy rimanda al Profilo per scaricare i dati ed eliminare l\'account', () => {
    cy.visit('/privacy');
    cy.contains('a', 'Vai al Profilo').should('have.attr', 'href', '/profile');
  });
});

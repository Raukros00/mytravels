describe('Pagina "Hello world" con la mascotte (#169)', () => {
  beforeEach(() => {
    // Lingua fissa: la lingua dell'app dipende dal browser
    cy.visit('/hello-world', {
      onBeforeLoad: (win) => win.localStorage.setItem('wb_lang', 'it')
    });
  });

  it('è pubblica: si apre senza account e senza essere reindirizzata', () => {
    cy.location('pathname').should('eq', '/hello-world');
    cy.contains('h1', 'Hello, world!').should('be.visible');
    cy.contains('Ciao, viaggiatore!').should('be.visible');
  });

  it('toccando la mascotte salta e poi torna a riposo', () => {
    cy.get('.hello-bubble').should('contain', 'Toccami!');
    cy.get('.hello-mascot').click();
    cy.get('.hello-mascot').should('have.class', 'pose-jump');
    cy.get('.hello-bubble').should('contain', 'Si parte!');
    cy.get('.hello-pose-card.is-active').should('contain', 'Salto');
    // Dopo l'animazione torna a riposo
    cy.get('.hello-mascot', { timeout: 4000 }).should('have.class', 'pose-idle');
    cy.get('.hello-pose-card.is-active').should('contain', 'Riposo');
  });

  it('i pulsanti Tocca, Saluta e Salta cambiano la posa e il fumetto', () => {
    cy.contains('.hello-reaction', 'Saluta').click();
    cy.get('.hello-mascot').should('have.class', 'pose-wave');
    cy.get('.hello-bubble').should('contain', 'Benvenuto alla ciurma!');

    cy.contains('.hello-reaction', 'Tocca').click();
    cy.get('.hello-mascot').should('have.class', 'pose-poke');
    cy.get('.hello-bubble').should('contain', 'Morbido come un bao caldo!');

    cy.contains('.hello-reaction', 'Salta').click();
    cy.get('.hello-mascot').should('have.class', 'pose-jump');
  });

  it('le card delle pose mostrano la posa scelta', () => {
    cy.contains('.hello-pose-card', 'Saluto').contains('button', 'Mostra posa').click();
    cy.get('.hello-mascot').should('have.class', 'pose-wave');
    cy.contains('.hello-pose-card', 'Saluto').should('have.class', 'is-active');
  });

  it('la mascotte si usa da tastiera ed è accessibile', () => {
    cy.get('button.hello-mascot')
      .should('have.attr', 'aria-label')
      .and('contain', 'mascotte');
    cy.get('button.hello-mascot').focus().should('have.focus');
    // Il fumetto viene annunciato agli screen reader
    cy.get('[aria-live="polite"]').should('exist');
  });

  it('con "riduci movimento" non c\'è animazione ma il riscontro resta', () => {
    cy.visit('/hello-world', {
      onBeforeLoad: (win) => win.localStorage.setItem('wb_lang', 'it')
    });
    // Emula la preferenza a livello di browser (Chrome/Electron)
    cy.wrap(Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setEmulatedMedia',
      params: { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }
    }));
    cy.get('.hello-mascot').click();
    cy.get('.hello-mascot').should('have.css', 'animation-name', 'none');
    cy.get('.hello-bubble').should('contain', 'Si parte!');
  });

  it('i testi seguono la lingua scelta (inglese)', () => {
    cy.visit('/hello-world', {
      onBeforeLoad: (win) => win.localStorage.setItem('wb_lang', 'en')
    });
    cy.contains("Hi, traveller! I'm the WanderBite mascot.").should('be.visible');
    cy.contains('.hello-bubble', 'Tap me!').should('be.visible');
  });
});

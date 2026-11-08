import { USERS } from '../support/users';

describe('Navigazione, dashboard e profilo', () => {
  beforeEach(() => cy.login('admin'));

  it('la home porta alla lista viaggi', () => {
    cy.visit('/');
    cy.location('pathname').should('eq', '/trips');
    cy.contains('h1', 'Viaggi').should('be.visible');
  });

  it('una rotta inesistente porta alla lista viaggi', () => {
    cy.visit('/pagina-che-non-esiste');
    cy.location('pathname').should('eq', '/trips');
  });

  it('i link della navbar aprono Esplora, Viaggi e Gruppi', () => {
    cy.visit('/trips');
    cy.get('header nav').within(() => {
      cy.contains('a', 'Esplora').click();
    });
    cy.location('pathname').should('eq', '/explore');
    cy.contains('h1', 'Esplora').should('be.visible');

    cy.get('header nav').contains('a', 'Gruppi').click();
    cy.location('pathname').should('eq', '/groups');

    cy.get('header nav').contains('a', 'Viaggi').click();
    cy.location('pathname').should('eq', '/trips');
    cy.get('header nav').contains('a', 'Viaggi').should('have.class', 'desktop-nav-active');
  });

  it('il logo riporta ai viaggi', () => {
    cy.visit('/groups');
    cy.get('header a[href="/trips"]').first().click();
    cy.location('pathname').should('eq', '/trips');
  });

  it('il menu utente mostra nome, email e il link al profilo', () => {
    cy.visit('/trips');
    // Senza foto profilo l'avatar mostra l'emoji scelta (👑 per l'admin demo).
    cy.get(`button[title="${USERS.admin.name}"]`).find('app-user-avatar').should('contain.text', '👑');
    cy.get(`button[title="${USERS.admin.name}"]`).click();
    cy.contains(USERS.admin.email).should('be.visible');
    cy.contains('a', 'Profilo').click();
    cy.location('pathname').should('eq', '/profile');
  });

  it('il pannello notifiche si apre dalla campanella', () => {
    cy.visit('/trips');
    cy.get('button[title="Notifiche"]').click();
    cy.contains('header', 'Notifiche').should('be.visible');
  });

  it('il cambio lingua passa all\'inglese e viene ricordato', () => {
    cy.visit('/groups');
    cy.get('header').contains('button', 'EN').click();
    cy.get('header').contains('button', 'IT').should('be.visible');
    cy.window().its('localStorage').invoke('getItem', 'wb_lang').should('eq', 'en');

    cy.reload();
    cy.get('header').contains('button', 'IT').click();
    cy.window().its('localStorage').invoke('getItem', 'wb_lang').should('eq', 'it');
  });

  it('la dashboard saluta l\'utente e mostra le scorciatoie', () => {
    cy.visit('/dashboard');
    cy.contains('h1', `Ciao, ${USERS.admin.name}!`).should('be.visible');
    cy.get('a[href="/trips/new"]').should('be.visible');
    cy.get('a[href="/groups"]').should('be.visible');
  });

  // Contenuti, lingua, statistiche e layout del profilo: vedi profile.cy.ts.

  describe('su mobile', () => {
    beforeEach(() => cy.viewport('iphone-x'));

    it('la barra in basso naviga tra le sezioni e il + apre un nuovo viaggio', () => {
      cy.visit('/trips');
      cy.get('nav.md\\:hidden').within(() => {
        cy.contains('a', 'Gruppi').click();
      });
      cy.location('pathname').should('eq', '/groups');

      cy.get('nav.md\\:hidden a[href="/trips/new"]').click();
      cy.location('pathname').should('eq', '/trips/new');
    });
  });
});

import { uniq } from '../support/e2e';
import { GROUPS, USERS } from '../support/users';

const bottomNav = () => cy.get('nav[aria-label="Navigazione"]');

describe('Mobile – header e barra in basso', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
    cy.login('admin');
  });

  it('l\'header mostra solo il logo, al centro', () => {
    cy.visit('/trips');
    cy.get('header').within(() => {
      cy.contains('a', 'WanderBite').should('be.visible').then($logo => {
        const r = $logo[0].getBoundingClientRect();
        const width = $logo[0].ownerDocument.defaultView!.innerWidth;
        // centrato (tolleranza di qualche pixel)
        expect(Math.abs(r.left + r.width / 2 - width / 2)).to.be.lessThan(6);
      });
      cy.get('button[title="Notifiche"]').should('not.be.visible');
      cy.contains('button', 'EN').should('not.be.visible');
    });
  });

  it('l\'header su mobile non ha ombra né bordo', () => {
    cy.visit('/trips');
    cy.get('header').should($h => {
      const cs = getComputedStyle($h[0]);
      expect(cs.boxShadow).to.eq('none');
      expect(cs.borderBottomWidth).to.eq('0px');
    });
  });

  it('le voci ai lati della barra in basso non toccano il bordo dello schermo', () => {
    cy.visit('/trips');
    // La barra occupa tutta la larghezza dello schermo: si misura la distanza delle voci dai suoi bordi
    // (con la viewport del browser di test conterebbe anche la barra di scorrimento, che sui telefoni non c'è).
    cy.get('nav[aria-label="Navigazione"]').then($nav => {
      const nav = $nav[0].getBoundingClientRect();
      const items = $nav[0].querySelectorAll('.wb-nav-item');
      expect(items[0].getBoundingClientRect().left - nav.left).to.be.gte(10);
      expect(nav.right - items[items.length - 1].getBoundingClientRect().right).to.be.gte(10);
    });
  });

  it('i campi hanno testo di almeno 16px (niente zoom automatico di iOS al tocco)', () => {
    cy.visit('/trips/new');
    ['#title', '#destination', '#notes', '#groupId'].forEach(sel =>
      cy.get(sel).should($el => expect(parseFloat(getComputedStyle($el[0]).fontSize)).to.be.gte(16)));
  });

  it('scorrendo verso il basso l\'header sparisce e torna scorrendo verso l\'alto', () => {
    cy.visit('/trips');
    cy.get('.trip-card').should('have.length.greaterThan', 2);
    cy.get('header').should('not.have.class', '-translate-y-full');
    // Lo scroll della pagina è animato (scroll-behavior: smooth): si aspetta che arrivi a destinazione.
    cy.scrollTo(0, 900);
    cy.window().its('scrollY').should('be.gte', 600);
    cy.get('header').should('have.class', '-translate-y-full');
    cy.scrollTo(0, 300);
    cy.window().its('scrollY').should('be.lte', 320);
    cy.get('header').should('not.have.class', '-translate-y-full');
    cy.scrollTo(0, 0);
    cy.window().its('scrollY').should('eq', 0);
    cy.get('header').should('not.have.class', '-translate-y-full');
  });

  it('la barra in basso ha il profilo con l\'avatar e il pallino delle notifiche non lette', () => {
    const name = uniq('E2E Invito mobile');
    cy.createGroup('marco', name).then(group => {
      cy.me('admin').then(admin =>
        cy.api('marco', 'POST', '/api/v1/notifications', { recipientId: admin.id, groupId: group.id }));
    });
    cy.visit('/trips');
    bottomNav().within(() => {
      cy.get('button[aria-label="Account e notifiche"]').as('profile').should('contain.text', 'Profilo');
      cy.get('@profile').find('app-user-avatar').should('contain.text', '👑');
      cy.get('@profile').find('[aria-label="Notifiche non lette"]').should('exist');
      cy.get('@profile').click();
    });

    cy.dialog('Il tuo account').within(() => {
      cy.contains(USERS.admin.email).should('be.visible');
      cy.contains('p', name).should('contain.text', 'ti ha invitato');
    });
    // Aperto il pannello, le notifiche risultano lette.
    bottomNav().find('[aria-label="Notifiche non lette"]').should('not.exist');
  });

  it('dal pannello account si va al profilo, si cambia lingua e si esce', () => {
    cy.visit('/trips');
    bottomNav().find('button[aria-label="Account e notifiche"]').click();
    cy.dialog('Il tuo account').within(() => {
      cy.contains('button', 'Switch to English').click();
      cy.contains('button', 'Passa all\'italiano').click();
      cy.contains('a', 'Profilo').click();
    });
    cy.location('pathname').should('eq', '/profile');
    cy.get('[role="dialog"]').should('not.exist');

    bottomNav().find('button[aria-label="Account e notifiche"]').click();
    cy.dialog('Il tuo account').contains('button', 'Disconnetti').click();
    cy.location('pathname').should('eq', '/explore');
    bottomNav().contains('button', 'Accedi').should('be.visible');
  });

  it('nel dettaglio gruppo i pulsanti stanno sotto il testo, senza sovrapporsi', () => {
    cy.groupByName('admin', GROUPS.esploratori).then(g => cy.visit(`/groups/${g.id}`));
    cy.get('.group-hero-icon').then($icon => {
      const r = $icon[0].getBoundingClientRect();
      expect(Math.round(r.width)).to.eq(64);
      expect(Math.round(r.height)).to.eq(64);
    });
    cy.get('.group-hero-info').then($info => {
      const infoBottom = $info[0].getBoundingClientRect().bottom;
      cy.get('.hero-actions').then($actions => {
        expect($actions[0].getBoundingClientRect().top).to.be.gte(infoBottom);
      });
    });
  });
});

describe('Desktop – l\'header resta fisso', () => {
  it('scorrendo l\'header non sparisce e la barra in basso non c\'è', () => {
    cy.login('admin');
    cy.visit('/trips');
    cy.get('.trip-card').should('have.length.greaterThan', 2);
    cy.scrollTo(0, 900);
    cy.get('header').should('be.visible').then($h => expect($h[0].getBoundingClientRect().top).to.eq(0));
    bottomNav().should('not.be.visible');
  });
});

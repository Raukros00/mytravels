import itJson from '../../public/i18n/it.json';
import enJson from '../../public/i18n/en.json';
import { uniq } from '../support/e2e';
import { USERS } from '../support/users';

const t = itJson.profile;
const tEn = enJson.profile;

/** Valore della card statistica (`trips`, `groups`, `countries`, `upcoming`). */
const stat = (key: string) => cy.get(`.metric-card[data-stat="${key}"] .metric-value`);

/** I viaggi arrivano dopo il primo disegno: si aspetta che le statistiche siano caricate prima di misurare. */
const waitForStats = () => stat('trips').should($v => expect(Number($v.text())).to.be.gt(0));

/** Registra un utente nuovo via API: parte senza gruppi né viaggi. */
function registerUser(prefix: string) {
  const user = { email: `e2e.${prefix}.${Date.now()}@example.com`, password: 'Segreta123!' };
  const first = uniq('Pia');
  return cy.request('POST', '/auth/register', {
    firstName: first, lastName: 'Profilo', birthDate: '1990-05-17', ...user, avatar: '🧭', color: '#10b981',
  }).then(() => ({ ...user, name: `${first} Profilo` }));
}

describe('Profilo', () => {
  describe('contenuti', () => {
    beforeEach(() => cy.login('admin'));

    it('usa la struttura comune delle pagine e mostra i dati dell\'account', () => {
      cy.visit('/profile');
      cy.get('.page-wrapper > .app-container').within(() => {
        cy.contains('h1.page-title', t.page_title).should('be.visible');
        cy.contains('.profile-hero h2', USERS.admin.name).should('be.visible');
        cy.get('.profile-hero app-user-avatar').should('contain.text', '👑');
        cy.get('.profile-hero').should('contain.text', USERS.admin.email);
        // Regressione: il pipe date con locale fisso lanciava e svuotava la pagina.
        cy.contains('.profile-member-since', /^Membro da \p{Ll}+ \d{4}$/u).should('be.visible');

        cy.contains('.section-card .section-title', t.stats_title).should('be.visible');
        cy.get('.metric-card').should('have.length', 4);
        // admin è membro di 2 gruppi demo (Gli Esploratori, Weekend Warriors).
        stat('groups').should($v => expect(Number($v.text())).to.be.gte(2));

        cy.contains('.section-card .section-title', t.account_title).closest('.section-card').within(() => {
          cy.contains('.account-label', t.field_name).next().should('have.text', USERS.admin.name);
          cy.contains('.account-label', t.field_email).next().should('have.text', USERS.admin.email);
          cy.contains('.account-label', t.field_color).next().invoke('text').should('match', /^#[0-9a-f]{6}$/i);
        });
        // Statistiche, Account e Notifiche sul telefono (#95): nessuna sezione finta delle funzioni future.
        cy.get('.section-card').should('have.length', 3);
      });
    });

    it('nessun colore scritto nel template: solo variabili del tema', () => {
      cy.visit('/profile');
      cy.get('.profile-hero').should('be.visible');
      // L'unico stile inline ammesso è il colore scelto dall'utente (pallino del colore profilo).
      cy.get('app-profile [style*="color"]').each($el => {
        expect($el.is('.account-swatch, .ua'), $el[0].className).to.eq(true);
      });
    });

    it('dal profilo si può fare logout', () => {
      cy.visit('/profile');
      cy.contains('button.btn', t.logout).click();
      cy.location('pathname').should('eq', '/explore');
    });
  });

  describe('lingua', () => {
    it('in inglese testi e date seguono la lingua scelta', () => {
      registerUser('lang').then(user => {
        cy.login(user);
        cy.visit('/profile');
        cy.contains('.account-label', t.field_birth_date).next().should('have.text', '17 maggio 1990');

        cy.get('header').contains('button', 'EN').click();
        cy.contains('h1', tEn.page_title).should('be.visible');
        cy.contains('.section-title', tEn.stats_title).should('be.visible');
        cy.contains('.metric-label', tEn.stat_trips).should('be.visible');
        cy.contains('.metric-label', tEn.stat_countries).should('be.visible');
        cy.contains('.profile-member-since', /^Member since [A-Z][a-z]+ \d{4}$/).should('be.visible');
        cy.contains('.account-label', tEn.field_birth_date).next().should('have.text', '17 May 1990');
        cy.contains('button', tEn.logout).should('be.visible');
        cy.get('app-profile').should('not.contain.text', t.stats_title);
      });
    });
  });

  describe('statistiche', () => {
    it('contano i viaggi confermati di tutti i gruppi dell\'utente, non le proposte', () => {
      registerUser('stats').then(user => {
        const groupA = uniq('E2E Profilo A');
        const groupB = uniq('E2E Profilo B');
        cy.createGroup(user, groupA);
        cy.createGroup(user, groupB);
        // Gruppo A: uno futuro e uno concluso; gruppo B: uno futuro (stessa nazione con maiuscole
        // e spazi diversi) e uno in un'altra nazione, più una proposta che non deve contare.
        cy.createTrip(user, groupA, { title: 'Lisbona', destination: 'Lisbona', country: 'Portogallo', startDate: '2030-05-01', endDate: '2030-05-04' });
        cy.createTrip(user, groupA, { title: 'Siviglia', destination: 'Siviglia', country: 'Spagna', startDate: '2024-04-10', endDate: '2024-04-12' });
        cy.createTrip(user, groupB, { title: 'Porto', destination: 'Porto', country: ' portogallo ', startDate: '2031-03-01', endDate: '2031-03-03' });
        cy.createTrip(user, groupB, { title: 'Kyoto', destination: 'Kyoto', country: 'Giappone', startDate: '2025-10-01', endDate: '2025-10-08' });
        cy.createTrip(user, groupB, { title: 'Reykjavik', destination: 'Reykjavik', country: 'Islanda', startDate: '2030-08-01', endDate: '2030-08-05', decision: 'proposal' });

        cy.login(user);
        cy.visit('/profile');
        stat('trips').should('have.text', '4');
        stat('groups').should('have.text', '2');
        stat('countries').should('have.text', '3');
        stat('upcoming').should('have.text', '2');

        // Gli stessi numeri restano aprendo il profilo dopo un'altra pagina (cache dei viaggi).
        cy.visit('/groups');
        cy.contains(groupB).should('be.visible');
        cy.visit('/profile');
        stat('trips').should('have.text', '4');
        stat('upcoming').should('have.text', '2');
      });
    });

    it('un utente senza gruppi vede zero ovunque', () => {
      registerUser('empty').then(user => {
        cy.login(user);
        cy.visit('/profile');
        ['trips', 'groups', 'countries', 'upcoming'].forEach(key => stat(key).should('have.text', '0'));
      });
    });
  });

  describe('layout', () => {
    beforeEach(() => cy.login('admin'));

    it('su desktop sta nella colonna centrale, su due colonne', () => {
      cy.viewport(1440, 900);
      cy.visit('/profile');
      waitForStats();
      cy.get('.page-wrapper > .app-container').should($c => expect($c[0].getBoundingClientRect().width).to.be.lte(1200));
      cy.get('.profile-hero').then($hero => {
        const hero = $hero[0].getBoundingClientRect();
        cy.get('.profile-account').should($acc => {
          const acc = $acc[0].getBoundingClientRect();
          expect(acc.left, 'account a destra').to.be.gte(hero.right);
          expect(Math.abs(acc.top - hero.top), 'stessa riga').to.be.lessThan(2);
        });
      });
      cy.contains('button.btn', t.logout).should($btn => {
        expect($btn[0].getBoundingClientRect().width, 'non a tutta larghezza').to.be.lessThan(300);
      });
      cy.screenshot('profilo-desktop', { capture: 'viewport' });
    });

    describe('su iPhone', () => {
      beforeEach(() => cy.viewport('iphone-x'));

      it('una colonna, niente scroll orizzontale e niente sovrapposizioni con la barra in basso', () => {
        cy.visit('/profile');
        waitForStats();
        cy.get('.profile-hero').should('be.visible');
        cy.get('.profile-hero').then($hero => {
          const hero = $hero[0].getBoundingClientRect();
          cy.get('.profile-account').should($acc => {
            const acc = $acc[0].getBoundingClientRect();
            expect(Math.abs(acc.left - hero.left), 'stessa colonna').to.be.lessThan(2);
            expect(acc.top, 'account sotto').to.be.gte(hero.bottom);
          });
        });
        cy.document().should(doc => {
          expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth);
        });

        // In fondo alla pagina il pulsante Disconnetti resta sopra la barra in basso.
        // Scroll istantaneo (niente animazione) fino in fondo alla pagina.
        cy.document().then(doc => { doc.documentElement.style.scrollBehavior = 'auto'; });
        cy.scrollTo('bottom', { ensureScrollable: false });
        cy.window().should(win => {
          const max = win.document.documentElement.scrollHeight - win.innerHeight;
          expect(win.scrollY).to.be.gte(max - 2);
        });
        cy.get('nav[aria-label="Navigazione"]').should('be.visible').then($nav => {
          const navTop = $nav[0].getBoundingClientRect().top;
          cy.contains('button.btn', t.logout).should($btn => {
            const btn = $btn[0].getBoundingClientRect();
            expect(btn.top, 'pulsante dentro lo schermo').to.be.gte(0);
            expect(btn.bottom, 'pulsante sopra la barra in basso').to.be.lte(navTop);
          });
        });
        cy.screenshot('profilo-iphone', { capture: 'viewport' });
      });
    });
  });
});

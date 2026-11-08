import { uniq } from '../support/e2e';
import { USERS } from '../support/users';
import { toIsoDate } from '../../src/app/core/utils/date.utils';

const authModal = () => cy.dialog('Accedi o registrati');

function fillLogin(email: string, password: string) {
  authModal().within(() => {
    cy.get('#auth-login-email').type(email);
    cy.get('#auth-login-password').type(password, { log: false });
    cy.contains('button[type="submit"]', 'Continua').click();
  });
}

describe('Autenticazione (modale)', () => {
  describe('visitatore', () => {
    it('vede Esplora come home, senza modale', () => {
      cy.visit('/');
      cy.location('pathname').should('eq', '/explore');
      cy.contains('h1', 'Esplora').should('be.visible');
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('l\'header mostra logo, Esplora, lingua e l\'utente anonimo', () => {
      cy.visit('/explore');
      cy.get('header').within(() => {
        cy.contains('a', 'WanderBite').should('have.attr', 'href', '/explore');
        cy.contains('nav a', 'Esplora').should('be.visible').and('have.class', 'desktop-nav-active');
        cy.contains('nav a', 'Viaggi').should('not.exist');
        cy.contains('nav a', 'Gruppi').should('not.exist');
        cy.contains('button', 'EN').should('be.visible');
        cy.get('button[aria-label="Accedi o registrati"]').should('be.visible');
        cy.get('button[title="Notifiche"]').should('not.exist');
      });
    });

    it('il selettore della lingua funziona anche senza login', () => {
      cy.visit('/explore');
      cy.get('header').contains('button', 'EN').click();
      cy.get('header').contains('button', 'IT').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_lang').should('eq', 'en');
    });

    it('l\'utente anonimo apre la modale di accesso', () => {
      cy.visit('/explore');
      cy.get('header button[aria-label="Accedi o registrati"]').click();
      cy.dialog('Accedi o registrati').should('be.visible');
      cy.get('#auth-tab-login').should('have.attr', 'aria-selected', 'true');
    });

    describe('su mobile', () => {
      beforeEach(() => cy.viewport('iphone-x'));

      it('l\'header mostra solo il logo; Esplora e Accedi sono nella barra in basso', () => {
        cy.visit('/explore');
        cy.get('header').within(() => {
          cy.contains('a', 'WanderBite').should('be.visible');
          cy.contains('a', 'Esplora').should('not.be.visible');
          cy.get('button[aria-label="Accedi o registrati"]').should('not.be.visible');
        });
        cy.get('nav[aria-label="Navigazione"]').within(() => {
          cy.contains('a', 'Esplora').should('be.visible');
          cy.contains('a', 'Viaggi').should('not.exist');
          cy.contains('button', 'Accedi').click();
        });
        cy.dialog('Benvenuto su WanderBite').within(() => {
          cy.contains('button', 'Accedi o registrati').should('be.visible');
        });
        cy.dialog('Benvenuto su WanderBite').within(() => {
          cy.contains('button', 'Switch to English').click();
          cy.contains('button', 'Passa all\'italiano').should('be.visible');
          cy.contains('button', 'Accedi o registrati').click();
        });
        cy.dialog('Accedi o registrati').within(() => {
          // Testo dei campi ≥ 16px: iOS non ingrandisce la pagina al tocco (e non resta zoomata dopo il login).
          cy.get('#auth-login-email').should($i => expect(parseFloat(getComputedStyle($i[0]).fontSize)).to.be.gte(16));
        });
      });
    });

    it('una pagina protetta apre la modale sopra Esplora e dopo il login porta alla pagina', () => {
      cy.visit('/groups');
      cy.location('pathname').should('eq', '/explore');
      authModal().should('be.visible');
      cy.get('#auth-tab-login').should('have.attr', 'aria-selected', 'true');

      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('pathname').should('eq', '/groups');
      cy.toast(`Bentornato, ${USERS.admin.name}!`).should('be.visible');
    });

    it('chiudendo la modale resta su Esplora', () => {
      cy.visit('/trips');
      authModal().find('button[aria-label="Chiudi modale"]').click();
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('pathname').should('eq', '/explore');
      cy.visit('/profile');
      cy.location('pathname').should('eq', '/explore');
    });

    it('i vecchi link /login e /register aprono la modale sulla scheda giusta', () => {
      cy.visit('/register');
      cy.location('pathname').should('eq', '/explore');
      cy.get('#auth-tab-register').should('have.attr', 'aria-selected', 'true');

      cy.visit('/login?returnUrl=%2Fprofile');
      cy.get('#auth-tab-login').should('have.attr', 'aria-selected', 'true');
      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.location('pathname').should('eq', '/profile');
    });

    it('un returnUrl verso un altro sito viene ignorato', () => {
      cy.visit('/login?returnUrl=%2F%2Fevil.example.com');
      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('host').should('eq', new URL(Cypress.config('baseUrl')!).host);
      cy.location('pathname').should('eq', '/explore');
    });

    it('un utente in cache senza token non è considerato loggato (residuo modalità mock)', () => {
      cy.visit('/explore', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_seed_version', JSON.stringify('10'));
          win.localStorage.setItem(
            'wb_current_user',
            JSON.stringify({ id: 'usr_demo_1', name: 'Alessandro Dominici', email: 'alessandro@example.com' }),
          );
          win.localStorage.setItem('wb_groups', JSON.stringify([{ id: 'grp_1', name: 'Weekend Foodies', members: [] }]));
        },
      });
      cy.get('header button[aria-label="Accedi o registrati"]').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_current_user').should('be.null');
      cy.window().its('localStorage').invoke('getItem', 'wb_groups').should('be.null');
    });
  });

  describe('accedi', () => {
    beforeEach(() => {
      cy.visit('/explore');
      cy.get('header button[aria-label="Accedi o registrati"]').click();
      authModal().should('be.visible');
    });

    it('il form parte vuoto e "Continua" è disabilitato', () => {
      authModal().within(() => {
        cy.get('#auth-login-email').should('have.value', '');
        cy.get('#auth-login-password').should('have.value', '');
        cy.contains('button', 'Continua').should('be.disabled');
      });
    });

    it('valida il formato dell\'email', () => {
      authModal().within(() => {
        cy.get('#auth-login-email').type('non-una-email').blur();
        cy.contains('.form-error', 'Inserisci un indirizzo email valido.').should('be.visible');
        cy.get('#auth-login-password').type('qualcosa');
        cy.contains('button', 'Continua').should('be.disabled');
      });
    });

    it('con credenziali corrette chiude la modale e resta sulla pagina', () => {
      cy.intercept('POST', '/auth/login').as('login');
      fillLogin(USERS.admin.email, USERS.admin.password);
      cy.wait('@login').its('response.statusCode').should('eq', 200);
      cy.get('[role="dialog"]').should('not.exist');
      cy.location('pathname').should('eq', '/explore');
      cy.toast(`Bentornato, ${USERS.admin.name}!`).should('be.visible');
      cy.get('header nav').contains('a', 'Viaggi').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.a', 'string');
    });

    it('con password errata mostra l\'errore nella modale', () => {
      fillLogin(USERS.admin.email, 'password-sbagliata');
      authModal().find('.auth-error').should('contain.text', 'Email o password non corretti.');
      authModal().should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'wb_jwt').should('be.null');
    });

    it('passa alla scheda Registrati e l\'errore precedente sparisce', () => {
      fillLogin(USERS.admin.email, 'password-sbagliata');
      authModal().find('.auth-error').should('be.visible');
      authModal().contains('.auth-switch button', 'Registrati').click();
      cy.get('#auth-tab-register').should('have.attr', 'aria-selected', 'true');
      authModal().find('.auth-error').should('not.exist');
    });

    it('riaprendo la modale i campi sono di nuovo vuoti', () => {
      authModal().find('#auth-login-email').type('qualcuno@example.com');
      authModal().find('button[aria-label="Chiudi modale"]').click();
      cy.get('header button[aria-label="Accedi o registrati"]').click();
      authModal().find('#auth-login-email').should('have.value', '');
    });
  });

  describe('registrati', () => {
    beforeEach(() => {
      cy.visit('/explore');
      cy.get('header button[aria-label="Accedi o registrati"]').click();
      authModal().find('#auth-tab-register').click();
      cy.get('#auth-tab-register').should('have.attr', 'aria-selected', 'true');
    });

    /** Data ISO di `years` anni fa (± `days`). */
    const yearsAgo = (years: number, days = 0) => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - years);
      d.setDate(d.getDate() + days);
      return toIsoDate(d); // data locale, come l'app (non UTC: sbagliata tra mezzanotte e l'una)
    };

    function fillRegistration(first: string, last: string, email: string, birthDate = '1990-05-17') {
      cy.get('#auth-register-first-name').type(first);
      cy.get('#auth-register-last-name').type(last);
      cy.get('#auth-register-birth-date').type(birthDate);
      cy.get('#auth-register-email').type(email);
      cy.get('#auth-register-password').type('Segreta123!');
    }

    it('crea un nuovo account con nome, cognome, data di nascita e avatar', () => {
      const first = uniq('Mario');
      const email = `e2e.${Date.now()}@example.com`;
      cy.intercept('POST', '/auth/register').as('register');

      authModal().within(() => {
        cy.contains('button', 'Crea account').should('be.disabled');
        fillRegistration(first, 'Rossi', email);
        cy.get('.avatar-select-btn').eq(2).click().should('have.class', 'selected');
        cy.get('.color-btn').eq(1).click().should('have.class', 'selected');
        cy.contains('button', 'Crea account').click();
      });

      cy.wait('@register').then(({ request, response }) => {
        expect(response?.statusCode).to.eq(201);
        expect(request.body).to.include({ firstName: first, lastName: 'Rossi', birthDate: '1990-05-17', email });
        expect(request.body.profileImage).to.be.null;
        expect(response?.body.user).to.include({ firstName: first, lastName: 'Rossi', name: `${first} Rossi`, birthDate: '1990-05-17' });
      });
      cy.get('[role="dialog"]').should('not.exist');
      cy.toast(`Benvenuto su WanderBite, ${first} Rossi!`).should('be.visible');

      // Senza foto la navbar mostra l'avatar scelto; il profilo mostra la data di nascita.
      cy.get(`header button[title="${first} Rossi"]`).should('contain.text', '🎒');
      cy.visit('/profile');
      cy.contains('.profile-hero h2', `${first} Rossi`).should('be.visible');
      cy.contains('Data di nascita').next().should('contain.text', '17 maggio 1990');

      // Un utente nuovo non vede gruppi né viaggi di altri.
      cy.visit('/trips');
      cy.contains('Nessun viaggio ancora').should('be.visible');
    });

    it('carica e ritaglia una foto profilo', () => {
      const first = uniq('Giulia');
      const email = `e2e.foto.${Date.now()}@example.com`;
      cy.intercept('POST', '/auth/register').as('register');

      authModal().within(() => {
        fillRegistration(first, 'Verdi', email);
        cy.get('.avatar-grid').should('be.visible');
        cy.get('#auth-register-photo').selectFile('cypress/fixtures/profile-photo.png', { force: true });

        // Editor di ritaglio: zoom e trascinamento, finché non si conferma non si può inviare.
        cy.get('.cropper-stage').should('be.visible');
        cy.get('.cropper-img').should('be.visible');
        cy.contains('button', 'Crea account').should('be.disabled');
        cy.get('input[aria-label="Zoom"]').invoke('val', 2).trigger('input');
        cy.get('.cropper-stage')
          .trigger('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 })
          .trigger('pointermove', { pointerId: 1, clientX: 120, clientY: 200 })
          .trigger('pointerup', { pointerId: 1 });
        cy.contains('button', 'Usa questa foto').click();

        cy.get('.cropper-stage').should('not.exist');
        cy.get('img.photo-preview').should('have.attr', 'src').and('match', /^data:image\/jpeg;base64,/);
        // Con la foto l'avatar emoji non serve più.
        cy.get('.avatar-grid').should('not.exist');
        cy.contains('button', 'Crea account').click();
      });

      cy.wait('@register').then(({ request, response }) => {
        expect(response?.statusCode).to.eq(201);
        const photo: string = request.body.profileImage;
        expect(photo).to.match(/^data:image\/jpeg;base64,/);
        expect(photo.length, 'foto compressa').to.be.lessThan(60_000);
        expect(response?.body.user.profileImage).to.eq(photo);

        // L'immagine esportata è 320×320.
        cy.window().then(win => new Cypress.Promise<{ w: number; h: number }>(resolve => {
          const img = new win.Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.src = photo;
        })).should('deep.equal', { w: 320, h: 320 });
      });

      cy.get(`header button[title="${first} Verdi"] img`).should('have.attr', 'src').and('match', /^data:image\/jpeg/);
      cy.visit('/profile');
      cy.get('app-user-avatar img').should('be.visible');
    });

    it('la foto si può annullare, cambiare e rimuovere', () => {
      authModal().within(() => {
        cy.get('#auth-register-photo').selectFile('cypress/fixtures/profile-photo.png', { force: true });
        cy.contains('.cropper-actions button', 'Annulla').click();
        cy.get('.cropper-stage').should('not.exist');
        cy.get('img.photo-preview').should('not.exist');

        cy.get('#auth-register-photo').selectFile('cypress/fixtures/profile-photo.png', { force: true });
        cy.contains('button', 'Usa questa foto').click();
        cy.contains('label', 'Cambia foto').should('be.visible');
        cy.contains('button', 'Rimuovi').click();
        cy.get('img.photo-preview').should('not.exist');
        cy.contains('label', 'Carica una foto').should('be.visible');
      });
    });

    it('rifiuta un file che non è un\'immagine', () => {
      authModal().within(() => {
        cy.get('#auth-register-photo').selectFile('cypress/fixtures/not-an-image.txt', { force: true });
        cy.contains('.form-error', 'Formato non supportato').should('be.visible');
        cy.get('.cropper-stage').should('not.exist');
      });
    });

    it('rifiuta un\'email già registrata', () => {
      authModal().within(() => {
        fillRegistration('Doppio', 'Account', USERS.admin.email);
        cy.contains('button', 'Crea account').click();
        cy.get('.auth-error').should('contain.text', 'Esiste già un account con questa email.');
      });
    });

    it('richiede nome, cognome, data di nascita e una password di almeno 6 caratteri', () => {
      authModal().within(() => {
        cy.get('#auth-register-first-name').focus().blur();
        cy.contains('.form-error', 'Inserisci il tuo nome.').should('be.visible');
        cy.get('#auth-register-last-name').focus().blur();
        cy.contains('.form-error', 'Inserisci il tuo cognome.').should('be.visible');
        cy.get('#auth-register-birth-date').focus().blur();
        cy.contains('.form-error', 'Inserisci la tua data di nascita.').should('be.visible');
        cy.get('#auth-register-password').type('123').blur();
        cy.contains('.form-error', 'almeno 6 caratteri').should('be.visible');
      });
    });

    it('richiede almeno 14 anni', () => {
      authModal().within(() => {
        cy.get('#auth-register-birth-date').should('have.attr', 'max', yearsAgo(14));
        fillRegistration('Troppo', 'Giovane', `e2e.minore.${Date.now()}@example.com`, yearsAgo(14, 1));
        cy.contains('.form-error', 'almeno 14 anni').should('be.visible');
        cy.contains('button', 'Crea account').should('be.disabled');
        cy.get('#auth-register-birth-date').clear().type(yearsAgo(14));
        cy.contains('.form-error', 'almeno 14 anni').should('not.exist');
        cy.contains('button', 'Crea account').should('be.enabled');
      });
    });
  });

  describe('registrazione – validazione lato backend', () => {
    const valid = () => ({
      firstName: 'Api', lastName: 'Test', birthDate: '1990-01-01',
      email: `e2e.api.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`, password: 'Segreta123!',
    });
    const register = (body: Record<string, unknown>) =>
      cy.request({ method: 'POST', url: '/auth/register', body, failOnStatusCode: false });

    it('rifiuta chi ha meno di 14 anni', () => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 13);
      register({ ...valid(), birthDate: toIsoDate(d) }).then(res => {
        expect(res.status).to.eq(400);
        expect(res.body.message).to.contain('birthDate');
      });
    });

    it('rifiuta dati mancanti o una foto non valida', () => {
      register({ ...valid(), firstName: '' }).its('status').should('eq', 400);
      register({ ...valid(), birthDate: null }).its('status').should('eq', 400);
      register({ ...valid(), password: '123' }).its('status').should('eq', 400);
      register({ ...valid(), profileImage: 'javascript:alert(1)' }).its('status').should('eq', 400);
      register({ ...valid(), profileImage: `data:image/jpeg;base64,${'A'.repeat(400_004)}` }).its('status').should('eq', 400);
    });

    it('accetta una registrazione valida e salva il nome completo', () => {
      register(valid()).then(res => {
        expect(res.status).to.eq(201);
        expect(res.body.user).to.include({ name: 'Api Test', firstName: 'Api', lastName: 'Test', birthDate: '1990-01-01' });
      });
    });
  });

  describe('email senza distinzione tra maiuscole e minuscole', () => {
    const base = () => ({ firstName: 'Mario', lastName: 'Maiuscolo', birthDate: '1990-01-01', password: 'Segreta123!' });
    const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    it('registrazione con maiuscole e accesso in minuscolo con uno spazio finale', () => {
      const mixed = `Mario.E2E.${stamp()}@Esempio.IT`;
      const lower = mixed.toLowerCase();
      cy.request('POST', '/auth/register', { ...base(), email: mixed }).then(res => {
        expect(res.status).to.eq(201);
        expect(res.body.user.email).to.eq(lower);
      });
      cy.request('POST', '/auth/login', { email: `${lower} `, password: 'Segreta123!' }).then(res => {
        expect(res.status).to.eq(200);
        expect(res.body.user.email).to.eq(lower);
        cy.request({ url: '/auth/me', headers: { Authorization: `Bearer ${res.body.token}` } })
          .its('body.email').should('eq', lower);
      });
      cy.request('POST', '/auth/login', { email: `  ${mixed.toUpperCase()}`, password: 'Segreta123!' })
        .its('status').should('eq', 200);
    });

    it('non si può registrare la stessa email con maiuscole diverse', () => {
      const email = `doppio.${stamp()}@example.com`;
      const again = (variant: string) =>
        cy.request({ method: 'POST', url: '/auth/register', body: { ...base(), email: variant }, failOnStatusCode: false });
      cy.request('POST', '/auth/register', { ...base(), email }).its('status').should('eq', 201);
      again(email.toUpperCase()).its('status').should('eq', 409);
      again(` ${email} `).its('status').should('eq', 409);
      again(USERS.admin.email.toUpperCase()).its('status').should('eq', 409);
    });

    it('la ricerca utenti per email ignora maiuscole e spazi', () => {
      cy.api<any[]>('admin', 'GET', `/api/v1/users/search?q=${encodeURIComponent(` ${USERS.sofia.email.toUpperCase()} `)}`)
        .then(results => expect(results.map(r => r.name)).to.include(USERS.sofia.name));
    });

    it('dalla modale si accede scrivendo l\'email con maiuscole e spazi', () => {
      cy.intercept('POST', '/auth/login').as('login');
      cy.visit('/explore');
      cy.get('header button[aria-label="Accedi o registrati"]').click();
      authModal().find('#auth-login-email')
        .should('have.attr', 'autocapitalize', 'off')
        .and('have.attr', 'autocorrect', 'off')
        .and('have.attr', 'spellcheck', 'false');
      fillLogin(` ${USERS.admin.email.toUpperCase()} `, USERS.admin.password);
      cy.wait('@login').then(({ request, response }) => {
        expect(request.body.email).to.eq(USERS.admin.email.toUpperCase());
        expect(response?.statusCode).to.eq(200);
        expect(response?.body.user.email).to.eq(USERS.admin.email);
      });
      cy.get('[role="dialog"]').should('not.exist');
      cy.toast(`Bentornato, ${USERS.admin.name}!`).should('be.visible');
    });

    it('il campo email della registrazione non ha maiuscola automatica né correttore', () => {
      cy.visit('/register');
      authModal().find('#auth-register-email')
        .should('have.attr', 'autocapitalize', 'off')
        .and('have.attr', 'autocorrect', 'off')
        .and('have.attr', 'spellcheck', 'false');
    });
  });

  describe('sessione', () => {
    beforeEach(() => cy.login('admin'));

    it('per un utente loggato la home sono i viaggi e /login porta ai viaggi', () => {
      cy.visit('/');
      cy.location('pathname').should('eq', '/trips');
      cy.visit('/login');
      cy.location('pathname').should('eq', '/trips');
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('un token non valido chiude la sessione', () => {
      cy.visit('/trips', {
        onBeforeLoad(win) {
          win.localStorage.setItem('wb_jwt', JSON.stringify('token.non.valido'));
        },
      });
      cy.location('pathname').should('eq', '/explore');
      cy.get('header button[aria-label="Accedi o registrati"]').should('be.visible');
    });

    it('il logout dal menu utente chiude la sessione e svuota la cache', () => {
      cy.visit('/trips');
      cy.get(`button[title="${USERS.admin.name}"]`).click();
      cy.contains(USERS.admin.email).should('be.visible');
      cy.contains('button', 'Disconnetti').click();

      cy.location('pathname').should('eq', '/explore');
      cy.toast('Disconnessione effettuata').should('be.visible');
      cy.window().its('localStorage').then(ls => {
        expect(ls.getItem('wb_jwt')).to.be.null;
        expect(ls.getItem('wb_current_user')).to.be.null;
        expect(ls.getItem('wb_groups')).to.be.null;
        expect(ls.getItem('wb_trips')).to.be.null;
      });

      cy.visit('/trips');
      cy.location('pathname').should('eq', '/explore');
      authModal().should('be.visible');
    });
  });
});

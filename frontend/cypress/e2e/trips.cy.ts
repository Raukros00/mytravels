import { uniq } from '../support/e2e';
import { GROUPS, TRIPS } from '../support/users';

/** Data fissa (solo `Date`, i timer restano reali): Dolomiti è in corso, gli altri viaggi demo di admin in arrivo. */
const TODAY = new Date('2026-07-20T10:00:00Z');

describe('Viaggi – lista', () => {
  beforeEach(() => {
    cy.login('admin');
    cy.clock(TODAY, ['Date']);
    cy.visit('/trips');
  });

  it('mostra i viaggi di tutti i gruppi dell\'utente e non quelli degli altri', () => {
    cy.contains('.trip-title', TRIPS.barcellona).should('be.visible');
    cy.contains('.trip-title', TRIPS.lisbona).should('be.visible');
    cy.contains('.trip-title', TRIPS.amsterdam).should('be.visible');
    // admin non è membro di "Foodies on Tour"
    cy.contains('.trip-title', TRIPS.napoli).should('not.exist');
    cy.contains('.trip-title', TRIPS.tokyo).should('not.exist');
  });

  it('la card mostra destinazione, gruppo e tag', () => {
    cy.contains('.trip-card', TRIPS.barcellona).within(() => {
      cy.contains('.trip-location', 'Barcellona, Spagna');
      cy.contains('.trip-group', GROUPS.esploratori);
      cy.contains('.badge', '#Gourmet');
    });
  });

  it('evidenzia il viaggio in corso', () => {
    cy.get('.current-hero').should('contain.text', TRIPS.dolomiti).and('contain.text', 'In corso');
  });

  it('la ricerca filtra per titolo, destinazione e tag', () => {
    cy.get('.search-input').type('lisbona');
    cy.get('.trip-card').should('have.length', 1).first().should('contain.text', TRIPS.lisbona);

    cy.get('.search-input').clear().type('tulipani'); // tag di Amsterdam
    cy.get('.trip-card').should('have.length', 1).first().should('contain.text', TRIPS.amsterdam);

    cy.get('.search-input').clear().type('nessun-viaggio-così');
    cy.contains('Nessun risultato').should('be.visible');
    cy.get('.search-clear').click();
    cy.get('.trip-card').should('have.length.greaterThan', 3);
  });

  it('i filtri per stato mostrano solo i viaggi corrispondenti', () => {
    cy.contains('.filter-pill-btn', 'In corso').click().should('have.class', 'filter-pill-btn--active');
    cy.contains('.trip-title', TRIPS.dolomiti).should('be.visible');
    cy.contains('.trip-title', TRIPS.barcellona).should('not.exist');

    cy.contains('.filter-pill-btn', 'In arrivo').click();
    cy.contains('.trip-title', TRIPS.barcellona).should('be.visible');
    cy.contains('.trip-title', TRIPS.dolomiti).should('not.exist');

    cy.contains('.filter-pill-btn', 'Tutti').click();
    cy.contains('.trip-title', TRIPS.dolomiti).should('be.visible');
  });

  it('una card apre il dettaglio del viaggio', () => {
    cy.contains('.trip-card', TRIPS.lisbona).find('.trip-body').click();
    cy.location('pathname').should('match', /^\/trips\/[\w-]+$/);
    cy.contains('h1', TRIPS.lisbona).should('be.visible');
  });

  it('elimina un viaggio dal menu della card, dopo conferma', () => {
    const title = uniq('E2E da eliminare');
    cy.createTrip('admin', GROUPS.esploratori, { title });
    cy.reload();

    cy.contains('.trip-card', title).find('.card-menu-btn').click();
    cy.on('window:confirm', msg => {
      expect(msg).to.contain(title);
      return true;
    });
    cy.intercept('DELETE', '/api/v1/trips/*').as('delete');
    cy.contains('.trip-card', title).contains('button', 'Elimina viaggio').click();

    cy.wait('@delete').its('response.statusCode').should('eq', 200);
    cy.contains('.trip-title', title).should('not.exist');
    cy.reload();
    cy.contains('.trip-title', TRIPS.barcellona).should('be.visible');
    cy.contains('.trip-title', title).should('not.exist');
  });

  it('annullando la conferma il viaggio non viene eliminato', () => {
    const title = uniq('E2E da tenere');
    cy.createTrip('admin', GROUPS.esploratori, { title });
    cy.reload();

    cy.on('window:confirm', () => false);
    cy.contains('.trip-card', title).find('.card-menu-btn').click();
    cy.contains('.trip-card', title).contains('button', 'Elimina viaggio').click();
    cy.contains('.trip-title', title).should('be.visible');
  });
});

describe('Viaggi – utente senza gruppi', () => {
  it('vede lo stato vuoto con l\'invito a pianificare', () => {
    const email = `e2e.vuoto.${Date.now()}@example.com`;
    cy.request('POST', '/auth/register', { firstName: 'Senza', lastName: 'Gruppi', birthDate: '1990-01-01', email, password: 'Password1!', avatar: '🎒', color: '#10b981' });
    cy.login({ email, password: 'Password1!' });
    cy.visit('/trips');
    cy.contains('Nessun viaggio ancora').should('be.visible');
    cy.contains('button', 'Pianifica un Viaggio').click();
    cy.location('pathname').should('eq', '/trips/new');
  });
});

describe('Viaggi – creazione', () => {
  beforeEach(() => {
    cy.login('admin');
    cy.visit('/trips');
    cy.contains('a', 'Nuovo viaggio').click();
    cy.location('pathname').should('eq', '/trips/new');
    // Il select dei gruppi si popola quando arrivano i gruppi dal backend.
    cy.get('#groupId option').should('have.length.gte', 2);
  });

  it('crea un viaggio confermato e apre il dettaglio', () => {
    const title = uniq('E2E Tour di Torino');
    cy.intercept('POST', '/api/v1/trips').as('create');

    cy.groupByName('admin', GROUPS.esploratori).then(g => cy.get('#groupId').select(g.id));
    cy.get('#groupId option:selected').should('contain.text', GROUPS.esploratori);
    cy.get('#title').type(title);
    cy.get('#destination').type('Torino');
    cy.get('#country').clear().type('Italia');
    cy.get('#startDate').clear().type('2027-05-01');
    cy.get('#endDate').clear().type('2027-05-04');
    cy.get('#budgetEstimate').clear().type('420');
    // Il form parte con due tag predefiniti: li tolgo per verificare solo quelli inseriti.
    cy.get('.tag-badge').should('have.length', 2);
    cy.get('.tag-remove').first().click();
    cy.get('.tag-remove').first().click();
    cy.get('.tag-badge').should('not.exist');
    cy.get('#tagInput').type('Gianduiotti{enter}');
    cy.get('#tagInput').type('Musei');
    cy.contains('button', 'Aggiungi').click();
    cy.get('.tag-badge').should('have.length', 2);
    cy.contains('.tag-badge', 'Gianduiotti').find('.tag-remove').click();
    cy.get('.tag-badge').should('have.length', 1).and('contain.text', 'Musei');
    cy.get('.preset-item').eq(1).click().should('have.class', 'selected');
    cy.get('#notes').type('Bicerin al Caffè Al Bicerin.');
    cy.contains('button', 'Crea Viaggio').click();

    cy.wait('@create').then(({ request, response }) => {
      expect(response?.statusCode).to.eq(201);
      expect(request.body).to.include({ title, destination: 'Torino', startDate: '2027-05-01', endDate: '2027-05-04', budgetEstimate: 420 });
      expect(request.body.tags).to.deep.eq(['Musei']);
    });
    cy.toast(`Viaggio "${title}" creato con successo!`).should('be.visible');
    cy.location('pathname').should('match', /^\/trips\/[\w-]+$/);
    cy.contains('h1', title).should('be.visible');

    // Persistito: dopo un reload è ancora nella lista.
    cy.visit('/trips');
    cy.contains('.trip-card', title).should('contain.text', 'Torino, Italia');
  });

  it('crea una proposta e torna al gruppo, dove è votabile', () => {
    const title = uniq('E2E Proposta Sicilia');
    cy.groupByName('admin', GROUPS.esploratori).then(g => cy.get('#groupId').select(g.id));
    cy.get('input[formControlName="asProposal"]').check();
    cy.get('#title').type(title);
    cy.get('#destination').type('Palermo');
    cy.contains('button', 'Crea Viaggio').click();

    cy.toast(`Proposta "${title}" creata`).should('be.visible');
    cy.location('pathname').should('match', /^\/groups\/[\w-]+$/);
    cy.contains('.proposals-title', /.+/).should('be.visible');
    cy.contains('.trip-title', title).should('be.visible');

    // Le proposte non compaiono tra i viaggi confermati.
    cy.visit('/trips');
    cy.contains('.trip-title', TRIPS.barcellona).should('be.visible');
    cy.contains('.trip-title', title).should('not.exist');
  });

  it('suggerisce copertine per la destinazione e salva il credito del fotografo', () => {
    const title = uniq('E2E Copertina suggerita');
    cy.intercept('GET', '/api/v1/covers/search*').as('covers');
    cy.intercept('POST', '/api/v1/trips').as('create');

    cy.get('#title').type(title);
    cy.get('#destination').type('Lisbona');
    cy.wait('@covers').its('request.query.q').should('eq', 'Lisbona');
    cy.contains('.form-label', 'Copertine per Lisbona').should('be.visible');
    cy.get('.cover-suggestion').should('have.length', 3);
    cy.contains('.cover-credit', 'Foto da').find('a').should('have.attr', 'href').and('contain', 'unsplash.com');

    cy.get('.cover-suggestion').eq(1).click().should('have.class', 'selected');
    cy.contains('.cover-credit', 'Foto di').within(() => {
      cy.contains('a', 'Fotografo 2').should('have.attr', 'href').and('contain', 'utm_source=wanderbite');
    });
    cy.get('#coverUrl').invoke('val').should('contain', '/img/stub2').and('contain', 'w=1200');
    cy.contains('button', 'Crea Viaggio').click();

    cy.wait('@create').then(({ request }) => {
      expect(request.body.coverUrl).to.contain('/img/stub2');
      expect(request.body).to.include({ coverCreditName: 'Fotografo 2' });
      expect(request.body.coverCreditUrl).to.contain('unsplash.com/@fotografo2');
    });
    cy.contains('h1', title).should('be.visible');
    cy.contains('.hero-cover-credit', 'Foto di Fotografo 2 su Unsplash').should('be.visible');

    // Linee guida Unsplash: la scelta della foto viene segnalata come "download".
    cy.request('http://127.0.0.1:18090/__state').its('body.downloads').should('include', 'stub2');
  });

  it('scegliendo poi un preset il credito Unsplash non viene salvato', () => {
    const title = uniq('E2E Preset dopo suggerimento');
    cy.intercept('POST', '/api/v1/trips').as('create');
    cy.get('#title').type(title);
    cy.get('#destination').type('Porto');
    cy.get('.cover-suggestion').first().click();
    cy.get('.preset-item:not(.cover-suggestion)').eq(2).click();
    cy.contains('.cover-credit', 'Foto da').should('be.visible');
    cy.contains('button', 'Crea Viaggio').click();
    cy.wait('@create').its('request.body').should(body => {
      expect(body.coverCreditName).to.be.null;
      expect(body.coverUrl).not.to.contain('/img/stub');
    });
    cy.contains('h1', title).should('be.visible');
    cy.get('.hero-cover-credit').should('not.exist');
  });

  it('con meno di 3 caratteri non cerca copertine', () => {
    cy.intercept('GET', '/api/v1/covers/search*', cy.spy().as('covers'));
    cy.get('#destination').type('Ro');
    cy.wait(800);
    cy.get('@covers').should('not.have.been.called');
    cy.get('.cover-suggestions').should('not.exist');
  });

  it('valida i campi obbligatori', () => {
    cy.contains('button', 'Crea Viaggio').should('be.disabled');
    cy.get('#title').type('ab').blur();
    cy.contains('.form-error', 'Il titolo del viaggio è obbligatorio.').should('be.visible');
    cy.get('#destination').focus().blur();
    cy.contains('.form-error', 'La destinazione è obbligatoria.').should('be.visible');
    cy.get('#title').type('c');
    cy.get('#destination').type('Bari');
    cy.contains('button', 'Crea Viaggio').should('be.enabled');
  });

  it('da un gruppo con icona foto: il gruppo è preselezionato e si vede il nome, non l\'URL dell\'immagine', () => {
    const name = uniq('E2E Icona foto');
    cy.fixture('profile-photo.png', 'base64').then(png => {
      cy.createGroup('admin', name, { icon: `data:image/png;base64,${png}` }).then(group => {
        cy.visit(`/groups/${group.id}`);
        cy.contains('button', 'Nuovo viaggio').click();
        cy.location('search').should('contain', `groupId=${group.id}`);

        cy.get('#groupId').should('have.value', group.id);
        cy.get('#groupId option:selected').should('have.text', name);
        cy.get('#groupId option').each($o => expect($o.text()).not.to.contain('data:image'));
        // Le icone emoji restano davanti al nome.
        cy.get('#groupId option').contains(GROUPS.esploratori).invoke('text').should('match', /^\S+ Gli Esploratori/);
      });
    });
  });

  it('"Annulla" e "Torna ai Viaggi" non creano nulla', () => {
    cy.intercept('POST', '/api/v1/trips', cy.spy().as('create'));
    cy.get('#title').type('Non salvare');
    cy.contains('a', 'Annulla').click();
    cy.location('pathname').should('eq', '/trips');
    cy.get('@create').should('not.have.been.called');
  });
});

import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * Salvataggi dei viaggi quando il backend risponde con un errore (simulato con cy.intercept):
 * l'utente viene avvisato e l'interfaccia torna allo stato precedente, senza viaggi "fantasma".
 */

const SERVER_ERROR = { statusCode: 500, body: { message: 'Errore simulato' } };

function openTab(label: string) {
  cy.contains('.trip-tab-btn', label).click().should('have.class', 'trip-tab-btn--active');
}

function savedTrip(id: string, assert: (trip: any) => void) {
  return cy.apiUntil('admin', `/api/v1/trips/${id}`, assert);
}

function addActivity(name: string) {
  cy.contains('button', 'Aggiungi Attrazione o Esperienza').click();
  cy.dialog('Aggiungi Attrazione').within(() => {
    cy.get('#act_name').type(name);
    cy.contains('button', 'Salva Attrazione').click();
  });
}

describe('Viaggi – creazione con errori del server', () => {
  beforeEach(() => {
    cy.login('admin');
    cy.visit('/trips/new');
    cy.get('#groupId option').should('have.length.gte', 2);
    cy.groupByName('admin', GROUPS.esploratori).then(g => cy.get('#groupId').select(g.id));
  });

  it('con errore 500 mostra l\'errore, resta sul form e non lascia viaggi fantasma', () => {
    const title = uniq('E2E Fantasma');
    cy.intercept('POST', '/api/v1/trips', SERVER_ERROR).as('create');
    cy.get('#title').type(title);
    cy.get('#destination').type('Bologna');
    cy.contains('button', 'Crea Viaggio').click();

    cy.wait('@create');
    cy.toast('Non è stato possibile creare il viaggio').should('be.visible');
    cy.contains('.toast-item', 'creato con successo').should('not.exist');
    // Il form resta compilato e si può riprovare.
    cy.location('pathname').should('eq', '/trips/new');
    cy.get('#title').should('have.value', title);
    cy.contains('button', 'Crea Viaggio').should('be.enabled');

    // Nessuna traccia del viaggio: né in lista, né nella cache del browser.
    cy.window().then(win => expect(win.localStorage.getItem('wb_trips') ?? '').not.to.contain(title));
    cy.visit('/trips');
    cy.contains('.trip-title', /.+/).should('exist');
    cy.contains('.trip-title', title).should('not.exist');
  });

  it('mentre il server salva il pulsante è bloccato; il viaggio si apre con l\'id definitivo', () => {
    const title = uniq('E2E Creazione lenta');
    cy.intercept('POST', '/api/v1/trips', req => {
      req.on('response', res => { res.setDelay(1200); });
    }).as('create');
    cy.get('#title').type(title);
    cy.get('#destination').type('Parma');
    cy.contains('button', 'Crea Viaggio').click();

    cy.contains('button', 'Salvataggio…').should('be.disabled');
    cy.location('pathname').should('eq', '/trips/new');
    cy.wait('@create').its('response.statusCode').should('eq', 201);
    cy.toast(`Viaggio "${title}" creato con successo!`).should('be.visible');
    cy.location('pathname').should('match', /^\/trips\/[0-9a-f-]{36}$/);
    cy.contains('h1', title).should('be.visible');

    // Una modifica subito dopo la creazione arriva al viaggio giusto.
    cy.intercept('POST', '/api/v1/trips/*/activities').as('addActivity');
    openTab('Attività');
    addActivity('Teatro Regio');
    cy.wait('@addActivity').its('response.statusCode').should('eq', 201);
    cy.location('pathname').then(path => {
      savedTrip(path.split('/').pop()!, t => expect(t.activities.map((a: any) => a.name)).to.deep.eq(['Teatro Regio']));
    });
  });

  it('un viaggio con id provvisorio rimasto nella cache non viene mostrato', () => {
    cy.visit('/trips/trip_123', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wb_trips', JSON.stringify([{
          id: 'trip_123', groupId: 'x', title: 'Viaggio fantasma', destination: 'Nessuna', country: '',
          startDate: '2027-01-01', endDate: '2027-01-02', status: 'planning', tags: [], activities: [], placesToEat: [],
        }]));
      },
    });
    cy.contains('h2', 'Viaggio non trovato').should('be.visible');
    cy.window().then(win => expect(win.localStorage.getItem('wb_trips') ?? '').not.to.contain('Viaggio fantasma'));
  });
});

describe('Viaggi – modifiche con errori del server', () => {
  let tripId: string;
  let title: string;

  beforeEach(() => {
    cy.login('admin');
    title = uniq('E2E Errori');
    cy.createTrip('admin', GROUPS.esploratori, { title, startDate: '2027-06-10', endDate: '2027-06-12' }).then(t => {
      tripId = t.id;
      cy.visit(`/trips/${tripId}`);
      cy.contains('h1', title).should('be.visible');
    });
  });

  it('un\'attività non salvata sparisce di nuovo e l\'utente viene avvisato', () => {
    cy.intercept('POST', '/api/v1/trips/*/activities', SERVER_ERROR).as('addActivity');
    openTab('Attività');
    addActivity('Mole Antonelliana');
    cy.wait('@addActivity');
    cy.toast('Non è stato possibile aggiungere l\'attrazione "Mole Antonelliana"').should('be.visible');
    cy.contains('.item-feed-title', 'Mole Antonelliana').should('not.exist');
    cy.contains('Nessuna attrazione trovata').should('be.visible');
    cy.contains('.toast-item', 'aggiunta!').should('not.exist');
  });

  it('un\'eliminazione fallita rimette l\'attività al suo posto', () => {
    cy.api('admin', 'POST', `/api/v1/trips/${tripId}/activities`, { name: 'Museo del Cinema', category: 'museum' });
    cy.reload();
    openTab('Attività');
    cy.contains('.item-feed-title', 'Museo del Cinema').should('be.visible');

    cy.intercept('DELETE', '/api/v1/trips/*/activities/*', SERVER_ERROR).as('delete');
    cy.on('window:confirm', () => true);
    cy.contains('.item-feed-card', 'Museo del Cinema').find('button[title="Elimina attività"]').click();
    cy.wait('@delete');
    cy.toast('Non è stato possibile rimuovere l\'attrazione').should('be.visible');
    cy.contains('.item-feed-title', 'Museo del Cinema').should('be.visible');
    savedTrip(tripId, t => expect(t.activities).to.have.length(1));
  });

  it('una spesa modificata senza successo torna all\'importo precedente', () => {
    cy.me('admin').then(me => {
      cy.api('admin', 'POST', `/api/v1/trips/${tripId}/expenses`, {
        title: 'Bicerin', amount: 12, paidBy: me.id, splitAmong: [me.id], shares: { [me.id]: 12 },
        type: 'expense', category: 'food', date: '2027-06-10',
      });
    });
    cy.reload();
    openTab('Spese');
    cy.contains('.exp-item', 'Bicerin').find('.exp-item-sub').invoke('text').should('match', /12[.,]00/);

    cy.intercept('PUT', '/api/v1/trips/*/expenses/*', SERVER_ERROR).as('update');
    cy.get('button[aria-label="Modifica spesa"]').click();
    cy.dialog('Modifica spesa').within(() => {
      cy.get('#exp_amount').clear().type('99');
      cy.contains('button', 'Salva modifiche').click();
    });
    cy.wait('@update');
    cy.toast('Non è stato possibile aggiornare la spesa').should('be.visible');
    cy.contains('.exp-item', 'Bicerin').find('.exp-item-sub').invoke('text').should('match', /12[.,]00/);
  });

  it('l\'alloggio non salvato torna ai dati precedenti', () => {
    cy.intercept('PUT', '/api/v1/trips/*/accommodation', SERVER_ERROR).as('save');
    openTab('Logistica');
    cy.contains('.filter-pill-btn', 'Alloggio').click();
    cy.contains('.sub-section-title', 'Struttura & Prenotazione').parent().find('button').click();
    cy.dialog('Dettagli Alloggio & Hotel').within(() => {
      cy.get('input[formControlName="name"]').clear().type('Hotel Mai Salvato');
      cy.get('input[formControlName="address"]').clear().type('Via Roma, 1, Torino');
      cy.contains('button', 'Salva Alloggio').click();
    });
    cy.wait('@save');
    cy.toast('Non è stato possibile salvare l\'alloggio').should('be.visible');
    cy.contains('.hotel-title', 'Hotel Mai Salvato').should('not.exist');
    savedTrip(tripId, t => expect(t.accommodation?.name ?? null).not.to.eq('Hotel Mai Salvato'));
  });

  it('una modifica fatta subito dopo l\'aggiunta, prima della risposta, viene salvata', () => {
    // L'aggiunta impiega un po': nel frattempo l'attività viene pianificata nel giorno 2.
    cy.intercept('POST', '/api/v1/trips/*/activities', req => {
      req.on('response', res => { res.setDelay(1500); });
    }).as('addActivity');
    cy.intercept('PUT', '/api/v1/trips/*/activities/*').as('updateActivity');
    openTab('Attività');
    addActivity('Parco del Valentino');
    cy.contains('.item-feed-card', 'Parco del Valentino').contains('button', 'Pianifica').click();
    cy.dialog('Pianifica nel Giorno').within(() => {
      cy.get('select').select('2');
      cy.contains('button', 'Conferma').click();
    });

    cy.wait('@addActivity').its('response.statusCode').should('eq', 201);
    // La modifica parte solo dopo la creazione, quindi non riceve un 404.
    cy.wait('@updateActivity').its('response.statusCode').should('eq', 200);
    cy.contains('.item-feed-card', 'Parco del Valentino').contains('.meta-pill', 'Giorno 2');
    savedTrip(tripId, t => {
      expect(t.activities).to.have.length(1);
      expect(t.activities[0]).to.include({ name: 'Parco del Valentino', assignedDay: 2 });
    });
  });

  it('l\'eliminazione di un viaggio fallita lo rimette in lista', () => {
    cy.visit('/trips');
    cy.intercept('DELETE', '/api/v1/trips/*', SERVER_ERROR).as('delete');
    cy.on('window:confirm', () => true);
    cy.contains('.trip-card', title).find('.card-menu-btn').click();
    cy.contains('.trip-card', title).contains('button', 'Elimina viaggio').click();
    cy.wait('@delete');
    cy.toast(`Non è stato possibile eliminare il viaggio "${title}"`).should('be.visible');
    cy.contains('.trip-title', title).should('be.visible');
    cy.contains('.toast-item', 'rimosso').should('not.exist');
  });
});

describe('Esplora – assegnazione con errori del server', () => {
  it('se il salvataggio fallisce a metà non resta nessun viaggio incompleto', () => {
    cy.login('admin');
    const groupName = uniq('E2E Esplora errore');
    cy.createGroup('admin', groupName).then(group => {
      cy.intercept('POST', '/api/v1/trips/*/places-to-eat', SERVER_ERROR).as('addPlace');
      cy.visit('/explore/tpl_barcellona');
      cy.contains('button', 'Assegna a un gruppo').click();
      cy.dialog('Assegna a un gruppo').within(() => {
        cy.contains('.am-group', groupName).click();
        cy.get('#am-start').clear().type('2027-09-01');
        cy.contains('button', 'Assegna e apri').click();
      });

      cy.wait('@addPlace');
      cy.toast('Non è stato possibile salvare il viaggio sul server').should('be.visible');
      // La modale resta aperta per riprovare e non si apre nessun viaggio.
      cy.dialog('Assegna a un gruppo').contains('button', 'Assegna e apri').should('be.enabled');
      cy.location('pathname').should('eq', '/explore/tpl_barcellona');
      cy.apiUntil<any[]>('admin', `/api/v1/trips/group/${group.id}`, trips => expect(trips).to.have.length(0));
    });
  });
});

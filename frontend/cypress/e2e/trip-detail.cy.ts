import { uniq } from '../support/e2e';
import { GROUPS, TRIPS } from '../support/users';

/** Apre il dettaglio di un viaggio cercandolo per titolo tra quelli del gruppo. */
function visitTripByTitle(groupName: string, title: string) {
  return cy.groupByName('admin', groupName).then(group =>
    cy.api<any[]>('admin', 'GET', `/api/v1/trips/group/${group.id}`).then(trips => {
      const trip = trips.find(t => t.title === title);
      expect(trip, `viaggio "${title}"`).to.exist;
      cy.visit(`/trips/${trip.id}`);
      cy.contains('h1', title).should('be.visible');
      return cy.wrap(trip);
    }),
  );
}

function openTab(label: string) {
  cy.contains('.trip-tab-btn', label).click().should('have.class', 'trip-tab-btn--active');
}

/** Attende che il viaggio salvato sul backend soddisfi `assert`. */
function savedTrip(id: string, assert: (trip: any) => void) {
  return cy.apiUntil('admin', `/api/v1/trips/${id}`, assert);
}

/** Attende che le spese salvate sul backend soddisfino `assert`. */
function savedExpenses(id: string, assert: (expenses: any[]) => void) {
  return cy.apiUntil<any[]>('admin', `/api/v1/trips/${id}/expenses`, assert);
}

describe('Dettaglio viaggio – dati demo (sola lettura)', () => {
  beforeEach(() => {
    cy.login('admin');
    visitTripByTitle(GROUPS.esploratori, TRIPS.barcellona);
  });

  it('mostra l\'hero e i contatori delle tab', () => {
    cy.get('.hero-cover-title').should('have.text', TRIPS.barcellona);
    cy.contains('.trip-tab-btn', 'Food & Drink').find('.trip-tab-counter').should('have.text', '5');
    cy.contains('.trip-tab-btn', 'Attività').find('.trip-tab-counter').should('have.text', '6');
  });

  it('l\'itinerario mostra un giorno per ogni data e le tappe del giorno', () => {
    // 15 → 18 settembre: 4 giorni
    cy.get('.day-chip-btn').should('have.length', 4);
    cy.contains('.day-chip-btn', 'Giorno 1').should('have.class', 'day-chip-btn--active');
    cy.contains('.timeline-name', 'Sagrada Família').should('be.visible');
    cy.contains('.timeline-name', 'El Xampanyet').should('be.visible');

    cy.contains('.day-chip-btn', 'Giorno 2').click().should('have.class', 'day-chip-btn--active');
    cy.contains('.section-title', 'Mappa del Giorno 2').should('be.visible');
    cy.contains('.timeline-name', 'Museu Picasso').should('be.visible');
    cy.contains('.timeline-name', 'Sagrada Família').should('not.exist');
  });

  it('Food & Drink: elenco, ricerca e filtro per categoria', () => {
    openTab('Food & Drink');
    cy.get('.item-feed-title').should('have.length', 5);
    cy.get('.search-input').type('vermouth'); // specialità di Bar Mut
    cy.get('.item-feed-title').should('have.length', 1).and('have.text', 'Bar Mut');
    cy.get('.clear-search-btn').click();
    cy.get('.item-feed-title').should('have.length', 5);
  });

  it('Attività: elenco e ricerca', () => {
    openTab('Attività');
    cy.contains('.section-title', 'Cose da Vedere & Fare').should('be.visible');
    cy.get('.item-feed-title').should('have.length', 6);
    cy.get('.search-input').type('picasso');
    cy.get('.item-feed-title').should('have.length', 1).and('have.text', 'Museu Picasso');
  });

  it('Logistica: voli, alloggio e trasporti', () => {
    openTab('Logistica');
    cy.contains('.flight-airline-name', 'Vueling').should('be.visible');
    cy.contains('VY6140').should('be.visible');

    cy.contains('.filter-pill-btn', 'Alloggio').click();
    cy.contains('.hotel-title', 'Hotel Arts Barcelona').should('be.visible');
    cy.contains('ARTS-2026-BCN').should('be.visible');

    cy.contains('.filter-pill-btn', 'Trasporti').click();
    cy.contains('.info-title', 'Abbonamenti & Pass').should('be.visible');
    cy.contains('T-Casual').should('be.visible');
  });

  it('Spese: senza spese mostra lo stato vuoto', () => {
    openTab('Spese');
    cy.contains('Nessuna spesa registrata').should('be.visible');
  });

  it('il link "Tutti i viaggi" torna alla lista', () => {
    cy.contains('a', 'Tutti i viaggi').click();
    cy.location('pathname').should('eq', '/trips');
  });
});

describe('Dettaglio viaggio – modifiche', () => {
  let tripId: string;

  beforeEach(() => {
    cy.login('admin');
    const title = uniq('E2E Dettaglio');
    cy.createTrip('admin', GROUPS.esploratori, { title, startDate: '2027-06-10', endDate: '2027-06-12' }).then(t => {
      tripId = t.id;
      cy.visit(`/trips/${tripId}`);
      cy.contains('h1', title).should('be.visible');
    });
  });

  it('aggiunge un\'attività, la pianifica in un giorno e la rimuove', () => {
    openTab('Attività');
    cy.contains('Nessuna attrazione trovata').should('be.visible');
    cy.contains('button', 'Aggiungi Attrazione o Esperienza').click();

    cy.dialog('Aggiungi Attrazione').within(() => {
      cy.contains('button', 'Salva Attrazione').should('be.disabled');
      cy.get('#act_name').type('Museo Egizio');
      cy.get('#act_category').select('museum');
      cy.get('#act_address').type('Via Accademia delle Scienze, 6');
      cy.contains('.form-label', 'Servono Biglietti?').parent().contains('label', 'Sì').find('input').check();
      cy.get('#act_price').clear().type('18');
      cy.get('#act_hours').type('09:00 - 18:30');
      cy.get('#act_notes').type('Prenotare online.');
      cy.contains('button', 'Salva Attrazione').click();
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.toast('Attrazione "Museo Egizio" aggiunta!').should('be.visible');

    cy.contains('.item-feed-card', 'Museo Egizio').within(() => {
      cy.contains('.meta-pill', 'Nel backlog');
      cy.contains('.meta-pill', 'Museo');
      cy.contains('.meta-pill', 'Biglietto €18');
    });
    savedTrip(tripId, t => {
      expect(t.activities).to.have.length(1);
      expect(t.activities[0]).to.include({ name: 'Museo Egizio', category: 'museum' });
    });

    // Pianifica nel giorno 2
    cy.contains('.item-feed-card', 'Museo Egizio').contains('button', 'Pianifica').click();
    cy.dialog('Pianifica nel Giorno').within(() => {
      cy.contains('strong', 'Museo Egizio');
      cy.get('select').select('2');
      cy.get('#assign_start').type('10:00');
      cy.get('#assign_end').type('12:00');
      cy.contains('button', 'Conferma').click();
    });
    cy.contains('.item-feed-card', 'Museo Egizio').contains('.meta-pill', 'Giorno 2');
    savedTrip(tripId, t => expect(t.activities[0]).to.include({ assignedDay: 2, startTime: '10:00', endTime: '12:00', timeSlot: '10:00 - 12:00' }));

    // Compare nell'itinerario del giorno 2
    openTab('Itinerario');
    cy.contains('.day-chip-btn', 'Giorno 2').click();
    cy.contains('.timeline-name', 'Museo Egizio').should('be.visible');

    // Rimozione, dopo conferma
    openTab('Attività');
    cy.on('window:confirm', () => true);
    cy.contains('.item-feed-card', 'Museo Egizio').find('button[title="Elimina attività"]').click();
    cy.toast('Attrazione rimossa dal viaggio.').should('be.visible');
    cy.contains('.item-feed-title', 'Museo Egizio').should('not.exist');
    savedTrip(tripId, t => expect(t.activities).to.have.length(0));
  });

  it('aggiunge un locale, lo filtra per categoria e lo rimuove', () => {
    openTab('Food & Drink');
    cy.contains('Nessun locale trovato').should('be.visible');
    cy.get('.new-trip-btn').click();

    cy.dialog('Aggiungi Posto Dove Mangiare').within(() => {
      cy.get('#food_name').type('Del Cambio');
      cy.get('#food_category').select('dinner');
      cy.get('#food_price').select('€€€€');
      cy.get('#food_address').type('Piazza Carignano, 2');
      cy.get('#food_specialties').type('Agnolotti del plin');
      cy.contains('button', 'Salva Locale').click();
    });
    cy.toast('Posto "Del Cambio" aggiunto ai ristoranti!').should('be.visible');
    cy.contains('.trip-tab-btn', 'Food & Drink').find('.trip-tab-counter').should('have.text', '1');
    cy.contains('.item-feed-title', 'Del Cambio').should('be.visible');
    savedTrip(tripId, t => {
      expect(t.placesToEat).to.have.length(1);
      expect(t.placesToEat[0]).to.include({ name: 'Del Cambio', category: 'dinner', priceRange: '€€€€' });
    });

    cy.get('.search-input').type('plin');
    cy.get('.item-feed-title').should('have.length', 1);
    cy.get('.clear-search-btn').click();

    cy.on('window:confirm', () => true);
    cy.contains('.item-feed-card', 'Del Cambio').find('button[title="Elimina locale"]').click();
    cy.toast('Locale rimosso.').should('be.visible');
    cy.contains('.item-feed-title', 'Del Cambio').should('not.exist');
    savedTrip(tripId, t => expect(t.placesToEat).to.have.length(0));
  });

  it('salva i dettagli dell\'alloggio', () => {
    openTab('Logistica');
    cy.contains('.filter-pill-btn', 'Alloggio').click();
    cy.contains('.sub-section-title', 'Struttura & Prenotazione').parent().find('button').click();

    cy.dialog('Dettagli Alloggio & Hotel').within(() => {
      cy.get('input[formControlName="name"]').clear().type('Hotel Principi di Piemonte');
      cy.get('input[formControlName="address"]').clear().type('Via Gobetti, 15, Torino');
      cy.get('input[formControlName="bookingCode"]').clear().type('PDP-777');
      cy.contains('button', 'Salva Alloggio').click();
    });
    cy.toast('Dettagli hotel aggiornati!').should('be.visible');
    cy.contains('.hotel-title', 'Hotel Principi di Piemonte').should('be.visible');
    savedTrip(tripId, t => expect(t.accommodation).to.include({ name: 'Hotel Principi di Piemonte', bookingCode: 'PDP-777' }));
  });

  it('salva i voli di andata', () => {
    openTab('Logistica');
    cy.contains('.sub-section-title', 'Biglietti e Voli').parent().find('button').click();
    cy.dialog('Dettagli Voli A/R').within(() => {
      cy.get('input[formControlName="outAirline"]').clear().type('ITA Airways');
      cy.get('input[formControlName="outFlightNum"]').clear().type('AZ1415');
      cy.contains('button', 'Salva Voli').click();
    });
    cy.toast('Dettagli voli salvati!').should('be.visible');
    cy.contains('.flight-airline-name', 'ITA Airways').should('be.visible');
    savedTrip(tripId, t => expect(t.flights?.outboundFlight).to.include({ airline: 'ITA Airways', flightNumber: 'AZ1415' }));
  });

  it('salva le informazioni sui trasporti', () => {
    openTab('Logistica');
    cy.contains('.filter-pill-btn', 'Trasporti').click();
    cy.contains('.sub-section-title', 'Spostamenti Aeroporto').parent().find('button').click();
    cy.dialog('Spostamenti Aeroporto → Hotel').within(() => {
      cy.get('select').first().select('train');
      cy.get('input[formControlName="estimatedDuration"]').clear().type('45 minuti');
      cy.contains('button', 'Salva').click();
    });
    cy.toast('Informazioni spostamenti aeroporto salvate!').should('be.visible');
    savedTrip(tripId, t => expect(t.transfers).to.include({ recommendedOption: 'train', estimatedDuration: '45 minuti' }));
  });

  it('registra una spesa divisa tra i membri, la modifica e la elimina', () => {
    openTab('Spese');
    cy.contains('Nessuna spesa registrata').should('be.visible');
    cy.contains('button', 'Aggiungi spesa').first().click();

    cy.dialog('Aggiungi spesa').within(() => {
      cy.get('#exp_title').type('Cena al Cambio');
      cy.get('#exp_amount').type('90');
      cy.get('#exp_paidBy option:selected').should('contain.text', '(tu)');
      cy.contains('button', 'In parti uguali').should('have.class', 'split-toggle-btn--active');
      cy.contains('button', 'Aggiungi spesa').click();
    });
    cy.toast('Spesa "Cena al Cambio" aggiunta!').should('be.visible');
    cy.contains('.trip-tab-btn', 'Spese').find('.trip-tab-counter').should('have.text', '1');
    cy.contains('.exp-item-title', 'Cena al Cambio').should('be.visible');
    cy.contains('.section-title', 'Saldi').should('be.visible');
    // admin, sofia e marco: 90 € in tre, admin ha anticipato tutto → gli altri devono 30 € a testa
    cy.contains('.section-title', 'Salda i conti').should('be.visible');
    cy.get('.exp-transfer-amount').should('have.length', 2).each($a => expect($a.text()).to.match(/30[.,]00/));
    savedExpenses(tripId, e => {
      expect(e).to.have.length(1);
      expect(e[0]).to.include({ title: 'Cena al Cambio', amount: 90 });
    });

    // Modifica
    cy.get('button[aria-label="Modifica spesa"]').click();
    cy.dialog('Modifica spesa').within(() => {
      cy.get('#exp_amount').clear().type('120');
      cy.contains('button', 'Salva modifiche').click();
    });
    cy.toast('Spesa aggiornata!').should('be.visible');
    cy.contains('.exp-item', 'Cena al Cambio').find('.exp-item-sub').invoke('text').should('match', /120[.,]00/);
    savedExpenses(tripId, e => expect(e[0].amount).to.eq(120));

    // Eliminazione, dopo conferma
    cy.on('window:confirm', msg => {
      expect(msg).to.contain('Cena al Cambio');
      return true;
    });
    cy.get('button[aria-label="Elimina"]').click();
    cy.toast('Spesa rimossa.').should('be.visible');
    cy.contains('Nessuna spesa registrata').should('be.visible');
    savedExpenses(tripId, e => expect(e).to.have.length(0));
  });

  it('il pulsante condividi copia il link del viaggio', () => {
    cy.window().then(win => {
      cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves();
    });
    cy.get('.hero-share-btn').click();
    cy.get('@copy').should('have.been.calledWithMatch', `/trips/${tripId}`);
    cy.toast('Link del viaggio copiato negli appunti!').should('be.visible');
  });
});

describe('Dettaglio viaggio – non trovato', () => {
  it('per un id inesistente mostra la pagina "Viaggio non trovato"', () => {
    cy.login('admin');
    cy.visit('/trips/id-che-non-esiste');
    cy.contains('h2', 'Viaggio non trovato').should('be.visible');
    cy.contains('button', 'Torna ai viaggi').click();
    cy.location('pathname').should('eq', '/trips');
  });
});

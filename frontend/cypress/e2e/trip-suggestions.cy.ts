import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * #105 Suggerimenti contestuali nella guida "In viaggio" (/trips/:id/live): inizio tappa, pasti con e senza
 * ristorante, prenotazioni e biglietti, chiusure, ritardi, fine giornata. Ora simulata con cy.clock (solo `Date`).
 * Il motore di regole ha i test unitari in src/app/core/utils/live-suggestions.utils.spec.ts.
 *
 * Viaggio a Barcellona, da lunedì 14 a mercoledì 16 ottobre 2030:
 *  - giorno 1 (lun): Sagrada Família 10:00–12:00 (biglietti 26 €, link), Bar Cañete a pranzo (prenotazione,
 *    orario indicativo 12:30–14:00), Museo Picasso 15:00–17:30 (aperto 9:00 - 17:00), Casa Batlló 18:00–19:00;
 *  - giorno 2 (mar): Museu Nacional 10:00–12:00 (chiuso il martedì), Park Güell 15:00–16:00;
 *  - idee non assegnate: Cervecería Catalana (vicino all'alloggio) e La Boqueria (senza coordinate);
 *  - alloggio: Hotel Arts, con coordinate.
 */

interface SuggestTrip { id: string; title: string }

const DAY1 = '2030-10-14';
const DAY2 = '2030-10-15';

const HOTEL = { lat: 41.3870, lng: 2.1700 };
const CERVECERIA = { lat: 41.3920, lng: 2.1620 };

function activity(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'monument', address: 'Barcelona', ticketsRequired: false, bookingRequired: false, ...extra };
}

function place(name: string, extra: Record<string, unknown> = {}) {
  return { name, category: 'lunch', priceRange: '€€', address: 'Barcelona', bookingRequired: false, ...extra };
}

function createSuggestTrip(): Cypress.Chainable<SuggestTrip> {
  const title = uniq('E2E Suggerimenti');
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Barcellona', startDate: DAY1, endDate: '2030-10-16' }).then(trip => {
    const base = `/api/v1/trips/${trip.id}`;
    cy.api('admin', 'POST', `${base}/activities`, activity('Sagrada Família', {
      assignedDay: 1, startTime: '10:00', endTime: '12:00', ticketsRequired: true, ticketPrice: 26, currency: 'EUR',
      bookingUrl: 'https://tickets.example.com/sagrada', coordinates: { lat: 41.4036, lng: 2.1744 }
    }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Museo Picasso', {
      assignedDay: 1, startTime: '15:00', endTime: '17:30', openingHours: '9:00 - 17:00'
    }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Casa Batlló', { assignedDay: 1, startTime: '18:00', endTime: '19:00' }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Museu Nacional', {
      assignedDay: 2, startTime: '10:00', endTime: '12:00', closingDays: 'chiuso il martedì'
    }));
    cy.api('admin', 'POST', `${base}/activities`, activity('Park Güell', { assignedDay: 2, startTime: '15:00', endTime: '16:00' }));
    cy.api('admin', 'POST', `${base}/places-to-eat`, place('Bar Cañete', { assignedDay: 1, assignedMeal: 'lunch', bookingRequired: true }));
    cy.api('admin', 'POST', `${base}/places-to-eat`, place('Cervecería Catalana', { assignedDay: null, coordinates: CERVECERIA }));
    cy.api('admin', 'POST', `${base}/places-to-eat`, place('La Boqueria', { assignedDay: null }));
    cy.api('admin', 'PUT', `${base}/accommodation`, { name: 'Hotel Arts', address: 'Carrer de la Marina 19', coordinates: HOTEL });
    return cy.wrap({ id: trip.id as string, title });
  });
}

/** Apre la guida con l'ora locale indicata. */
function openAt(trip: SuggestTrip, date: string, time: string, lang?: 'en') {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  cy.clock(new Date(y, m - 1, d, h, mi), ['Date']);
  cy.visit(`/trips/${trip.id}/live`, {
    onBeforeLoad(win) {
      if (lang) win.localStorage.setItem('wb_lang', lang);
    }
  });
  cy.contains('.live-trip-title', trip.title).should('be.visible');
}

const primary = () => cy.get('[data-cy="suggest-primary"]');
const suggestions = () => cy.get('[data-cy="live-suggestions"]');
const secondary = (text: string) => cy.contains('[data-cy="suggest-secondary"]', text);

function placeOf(tripId: string, name: string, assert: (p: any) => void) {
  return cy.apiUntil('admin', `/api/v1/trips/${tripId}`, (t: any) => assert(t.placesToEat.find((p: any) => p.name === name)));
}

describe('In viaggio – suggerimenti contestuali', () => {
  let trip: SuggestTrip;

  beforeEach(() => {
    cy.login('admin');
    createSuggestTrip().then(t => (trip = t));
  });

  it('inizio di una tappa: "Ora: …, poi …" con Indicazioni e Fatto; biglietti, prenotazione e chiusura tra i secondari', () => {
    openAt(trip, DAY1, '10:05');
    primary().should('have.attr', 'data-kind', 'start').within(() => {
      cy.get('.suggest-text').should('have.text', 'Ora: Sagrada Família, poi Bar Cañete.');
      cy.contains('a', 'Indicazioni').should('have.attr', 'href').and('contain', 'google.com/maps');
    });

    secondary('Per Sagrada Família servono i biglietti (26').within(() => {
      cy.contains('a', 'Apri link').should('have.attr', 'href', 'https://tickets.example.com/sagrada');
    });
    secondary('Museo Picasso chiude alle 17:00, prima della fine della visita in programma.')
      .contains('button', 'Sposta a un altro giorno').should('be.visible');

    // "Sì, l'ho fatta" chiude il promemoria della prenotazione, anche ricaricando.
    secondary('Il ristorante Bar Cañete richiede la prenotazione: l\'hai fatta?').contains('button', 'Sì').click();
    suggestions().should('not.contain.text', 'richiede la prenotazione');
    openAt(trip, DAY1, '10:05');
    primary().should('have.attr', 'data-kind', 'start');
    suggestions().should('not.contain.text', 'richiede la prenotazione');

    // Fatto: la tappa è segnata e la guida passa alla successiva.
    primary().contains('button', 'Fatto').click();
    cy.toast('"Sagrada Família" fatto ✓').should('be.visible');
    cy.contains('.live-timeline-item', 'Sagrada Família').should('have.attr', 'data-status', 'done');
  });

  it('ora di pranzo con il ristorante in programma: Andiamo, Scegli un altro (dal più vicino) e il locale cambia', () => {
    openAt(trip, DAY1, '12:15');
    primary().should('have.attr', 'data-kind', 'meal-planned').within(() => {
      cy.get('.suggest-text').should('have.text', 'È ora di pranzo: che ne dici di Bar Cañete, come programmato?');
      cy.contains('a', 'Andiamo').should('have.attr', 'href').and('contain', 'google.com/maps').and('contain', 'Bar');
      cy.contains('button', 'Saltiamo').should('be.visible');
      cy.contains('button', 'Scegli un altro').click();
      cy.get('[data-cy="suggest-places"] .suggest-place-name').then($els =>
        expect([...$els].map(e => e.textContent!.trim())).to.deep.equal(['Cervecería Catalana', 'La Boqueria']));
      // Distanza in linea d'aria dalla tappa precedente (Sagrada Família) solo per chi ha coordinate.
      cy.contains('.suggest-place', 'Cervecería Catalana').find('.suggest-distance').invoke('text').should('match', /^\d+,\d km$/);
      cy.contains('.suggest-place', 'La Boqueria').find('.suggest-distance').should('not.exist');
      cy.contains('.suggest-place', 'Cervecería Catalana').contains('button', 'Scegli').click();
    });

    cy.toast('Cervecería Catalana al posto di Bar Cañete: buon appetito!').should('be.visible');
    placeOf(trip.id, 'Cervecería Catalana', p => expect(p).to.include({ assignedDay: 1, assignedMeal: 'lunch' }));
    placeOf(trip.id, 'Bar Cañete', p => expect(p).to.include({ isSkipped: true, isVisited: false }));
    primary().find('.suggest-text').should('have.text', 'È ora di pranzo: che ne dici di Cervecería Catalana, come programmato?');
  });

  it('Saltiamo: il ristorante finisce tra le tappe saltate (flusso "Da recuperare")', () => {
    openAt(trip, DAY1, '12:15');
    primary().contains('button', 'Saltiamo').click();
    cy.toast('"Bar Cañete" saltato.').should('be.visible');
    cy.contains('.live-timeline-item', 'Bar Cañete').should('have.attr', 'data-status', 'skipped');
    placeOf(trip.id, 'Bar Cañete', p => expect(p).to.include({ isSkipped: true }));
    suggestions().should('not.contain.text', 'È ora di pranzo');
  });

  it('ora di pranzo senza ristorante: i locali salvati vicino, dal più vicino, e si sceglie dove mangiare', () => {
    // 12:15: la tappa del mattino è passata da poco (nessun ritardo da segnalare), il riferimento è l'alloggio.
    openAt(trip, DAY2, '12:15');
    primary().should('have.attr', 'data-kind', 'meal-none').within(() => {
      cy.get('.suggest-text').should('have.text', 'È ora di pranzo: hai 2 locali salvati vicino a te.');
      cy.contains('button', 'Lista').click();
      cy.get('.suggest-place-name').first().should('have.text', 'Cervecería Catalana');
      cy.contains('.suggest-place', 'Cervecería Catalana').find('a').should('have.attr', 'href').and('contain', 'google.com/maps');
      cy.contains('.suggest-place', 'La Boqueria').contains('button', 'Scegli').click();
    });
    cy.toast('La Boqueria aggiunto a oggi per pranzo.').should('be.visible');
    placeOf(trip.id, 'La Boqueria', p => expect(p).to.include({ assignedDay: 2, assignedMeal: 'lunch' }));
    primary().find('.suggest-text').should('have.text', 'È ora di pranzo: che ne dici di La Boqueria, come programmato?');
  });

  it('giorno di chiusura: "Oggi … è chiuso (martedì)" e Sposta apre il pannello della #112', () => {
    openAt(trip, DAY2, '09:30');
    primary().should('have.attr', 'data-kind', 'closed-today').and('have.attr', 'data-tone', 'warn').within(() => {
      cy.get('.suggest-text').should('have.text', 'Oggi Museu Nacional è chiuso (martedì).');
      cy.contains('button', 'Sposta a un altro giorno').click();
    });
    cy.get('[data-cy="move-panel"]').should('be.visible');
    cy.contains('Sposta Museu Nacional').should('be.visible');
  });

  it('in ritardo sul programma: proposta di spostare l\'ultima tappa, Ignora la chiude', () => {
    openAt(trip, DAY1, '14:40');
    primary().should('have.attr', 'data-kind', 'late').within(() => {
      cy.get('.suggest-text').should('have.text', 'Sei in ritardo di 40 min: vuoi spostare Casa Batlló a un altro giorno?');
      cy.contains('button', 'Sposta').should('be.visible');
      cy.contains('button', 'Ignora').click();
    });
    suggestions().should('not.contain.text', 'Sei in ritardo');

    // Sposta: pannello "Sposta" per Casa Batlló.
    cy.window().then(win => Object.keys(win.localStorage)
      .filter(k => k.startsWith('wb_live_dismissed'))
      .forEach(k => win.localStorage.removeItem(k)));
    openAt(trip, DAY1, '14:40');
    primary().contains('button', 'Sposta').click();
    cy.get('[data-cy="move-panel"]').should('be.visible');
    cy.contains('Sposta Casa Batlló').should('be.visible');
  });

  it('chiusura imminente durante la visita', () => {
    openAt(trip, DAY1, '16:15');
    suggestions().should('contain.text', 'Museo Picasso chiude alle 17:00: ti restano 45 min.');
  });

  it('fine giornata: "Giornata finita! Torna all\'alloggio" con le indicazioni', () => {
    openAt(trip, DAY1, '21:45');
    primary().should('have.attr', 'data-kind', 'day-end').within(() => {
      cy.get('.suggest-text').should('have.text', 'Giornata finita! Torna all\'alloggio: Hotel Arts.');
      // Destinazione: le coordinate dell'alloggio, con i mezzi pubblici (#106).
      cy.contains('a', 'Indicazioni').should('have.attr', 'href').and('contain', 'destination=41.387,2.17&travelmode=transit');
    });
  });

  it('in inglese i testi sono tradotti', () => {
    openAt(trip, DAY1, '12:15', 'en');
    primary().find('.suggest-text').should('have.text', 'Time for lunch: how about Bar Cañete, as planned?');
    primary().contains('a', 'Let\'s go');
  });

  it('su mobile i pulsanti dei suggerimenti sono ampi e la pagina non scorre in orizzontale', () => {
    cy.viewport('iphone-x');
    openAt(trip, DAY1, '12:15');
    primary().find('.suggest-action').each($b => expect($b[0].getBoundingClientRect().height).to.be.gte(44));
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.lte(doc.documentElement.clientWidth));
  });
});

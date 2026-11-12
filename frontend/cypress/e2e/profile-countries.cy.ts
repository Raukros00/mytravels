import itJson from '../../public/i18n/it.json';
import enJson from '../../public/i18n/en.json';
import { uniq } from '../support/e2e';

/** #123: badge delle nazioni visitate nel Profilo, con date simulate (cy.clock). */
const t = itJson.profile;
const tEn = enJson.profile;
// 10 maggio 2026, mezzogiorno in Italia.
const TODAY = new Date('2026-05-10T10:00:00Z');

function registerUser(prefix: string) {
  const user = { email: `e2e.countries.${prefix}.${Date.now()}@example.com`, password: 'Segreta123!' };
  return cy.request('POST', '/auth/register', {
    firstName: uniq('Paola'), lastName: 'Passaporto', birthDate: '1990-01-01', ...user, avatar: '🧭',
  }).then(() => user);
}

const badge = (code: string) => cy.get(`.country-badge[data-country="${code}"]`);

describe('Profilo: le mie nazioni (#123)', () => {
  it('badge per nazione con conteggi, anno della prima visita, viaggi in arrivo tratteggiati ed elenco dei viaggi', () => {
    registerUser('badges').then(user => {
      const groupA = uniq('E2E Nazioni A');
      const groupB = uniq('E2E Nazioni B');
      cy.createGroup(user, groupA);
      cy.createGroup(user, groupB);
      // Spagna: due viaggi conclusi (2023 e 2025) in gruppi diversi, codice dal luogo scelto e dal nome.
      cy.createTrip(user, groupA, { title: 'Siviglia', destination: 'Siviglia', country: 'Spagna', countryCode: 'ES', startDate: '2023-04-10', endDate: '2023-04-12' });
      cy.createTrip(user, groupB, { title: 'Madrid', destination: 'Madrid', country: ' spain ', startDate: '2025-02-01', endDate: '2025-02-03' });
      // Giappone: solo futuro → "in arrivo".
      cy.createTrip(user, groupA, { title: 'Kyoto', destination: 'Kyoto', country: 'Giappone', countryCode: 'JP', startDate: '2026-09-01', endDate: '2026-09-08' });
      // Francia: in corso oggi → non ancora visitata.
      cy.createTrip(user, groupB, { title: 'Parigi', destination: 'Parigi', country: 'Francia', startDate: '2026-05-08', endDate: '2026-05-12' });
      // Proposta e nazione non riconosciuta: nessun badge.
      cy.createTrip(user, groupA, { title: 'Reykjavik', destination: 'Reykjavik', country: 'Islanda', startDate: '2024-08-01', endDate: '2024-08-05', decision: 'proposal' });
      cy.createTrip(user, groupB, { title: 'Atlantide', destination: 'Atlantide', country: 'Atlantide', startDate: '2024-03-01', endDate: '2024-03-02' });

      cy.login(user);
      cy.clock(TODAY, ['Date']);
      cy.visit('/profile');

      cy.contains('.section-title', t.countries_title).should('be.visible');
      cy.get('.country-badge').should('have.length', 3);

      badge('ES').should('have.attr', 'data-state', 'visited')
        .and('contain.text', '🇪🇸').and('contain.text', 'Spagna')
        .and('contain.text', '2 viaggi').and('contain.text', 'dal 2023')
        .and('not.have.class', 'country-badge--upcoming');
      badge('JP').should('have.attr', 'data-state', 'upcoming').and('have.class', 'country-badge--upcoming')
        .and('contain.text', 'Giappone').and('contain.text', 'In arrivo · a settembre')
        .and('have.css', 'border-top-style', 'dashed');
      badge('FR').should('have.attr', 'data-state', 'upcoming');
      cy.get('.country-badge[data-country="IS"]').should('not.exist');

      // Nazioni esplorate = solo le visitate; il tocco porta alla sezione.
      cy.get('.metric-card[data-stat="countries"] .metric-value').should('have.text', '1');
      cy.get('a.metric-card[data-stat="countries"]').click();
      cy.get('#profile-countries').should('be.focused');

      // Tocco sul badge → elenco dei viaggi con link.
      badge('ES').click().should('have.attr', 'aria-expanded', 'true');
      cy.get('#profile-country-trips').within(() => {
        cy.get('a.country-trip-link').should('have.length', 2);
        cy.get('a.country-trip-link').first().should('contain.text', 'Madrid');
        cy.contains('a.country-trip-link', 'Siviglia').should('have.attr', 'href').and('match', /^\/trips\//);
      });
      cy.contains('a.country-trip-link', 'Madrid').click();
      cy.location('pathname').should('match', /^\/trips\/[\w-]+$/);
    });
  });

  it('nomi delle nazioni nella lingua attiva', () => {
    registerUser('lang').then(user => {
      const group = uniq('E2E Nazioni lingua');
      cy.createGroup(user, group);
      cy.createTrip(user, group, { title: 'Monaco', destination: 'Monaco di Baviera', country: 'Germania', countryCode: 'DE', startDate: '2025-10-01', endDate: '2025-10-03' });
      cy.login(user);
      cy.clock(TODAY, ['Date']);
      cy.visit('/profile');
      badge('DE').should('contain.text', 'Germania').and('contain.text', '1 viaggio');
      cy.get('header').contains('button', 'EN').click();
      cy.contains('.section-title', tEn.countries_title).should('be.visible');
      badge('DE').should('contain.text', 'Germany').and('contain.text', '1 trip').and('contain.text', 'since 2025');
    });
  });

  it('stato vuoto con invito a pianificare', () => {
    registerUser('empty').then(user => {
      cy.login(user);
      cy.visit('/profile');
      cy.contains(t.countries_empty).should('be.visible');
      cy.contains('a', t.countries_plan).should('have.attr', 'href', '/trips/new');
    });
  });

  it('API: il codice della nazione si salva dal luogo scelto o si ricava dal nome', () => {
    registerUser('api').then(user => {
      const group = uniq('E2E Nazioni API');
      cy.createGroup(user, group);
      cy.createTrip(user, group, { title: 'Zurigo', destination: 'Zurigo', country: 'Svizzera', countryCode: 'ch', startDate: '2030-01-01', endDate: '2030-01-02' })
        .its('countryCode').should('eq', 'CH');
      cy.createTrip(user, group, { title: 'Lima', destination: 'Lima', country: 'Perù', startDate: '2030-01-01', endDate: '2030-01-02' })
        .its('countryCode').should('eq', 'PE');
      cy.createTrip(user, group, { title: 'Boh', destination: 'Boh', country: 'Atlantide', countryCode: 'xyz', startDate: '2030-01-01', endDate: '2030-01-02' })
        .then((trip: any) => {
          expect(trip.countryCode).to.be.null;
          cy.api(user, 'PUT', `/api/v1/trips/${trip.id}`, { destination: 'Kyoto', country: 'Giappone', countryCode: 'JP' })
            .its('countryCode').should('eq', 'JP');
        });
    });
  });
});

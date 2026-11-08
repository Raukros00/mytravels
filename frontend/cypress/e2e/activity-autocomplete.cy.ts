import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * Autocompletamento di nome e indirizzo delle attrazioni (Photon/OpenStreetMap tramite il backend).
 * Il servizio è finto (e2e/api-stubs.py): "Sagrada" trova la Sagrada Familia di Sabadell (prima
 * senza posizione), la Basílica e la fermata "Sagrada Família" di Barcellona; "offline" risponde 503.
 */
const STUB_STATE = 'http://127.0.0.1:18090/__state';
const BARCELLONA = { lat: 41.38879, lng: 2.15899 };
const BASILICA = {
  name: 'Basílica de la Sagrada Família',
  address: 'Carrer de Mallorca 401, 08013 Barcelona, España',
  lat: 41.4035,
  lng: 2.17443,
};
const FERMATA = {
  name: 'Sagrada Família',
  address: 'Carrer de la Marina, 08013 Barcelona, España',
  lat: 41.40399,
  lng: 2.1751,
};

function openActivityModal(withDestinationCoords = true) {
  const title = uniq('E2E Luoghi');
  const place = withDestinationCoords
    ? { destinationPlaceId: '3128760', destinationIntlName: 'Barcelona', destinationLat: BARCELLONA.lat, destinationLng: BARCELLONA.lng }
    : {};
  return cy.createTrip('admin', GROUPS.esploratori, { title, destination: 'Barcellona', country: 'Spagna', ...place }).then(trip => {
    cy.visit(`/trips/${trip.id}`);
    cy.contains('h1', title).should('be.visible');
    cy.contains('.trip-tab-btn', 'Attività').click().should('have.class', 'trip-tab-btn--active');
    cy.contains('button', 'Aggiungi Attrazione o Esperienza').click();
    cy.dialog('Aggiungi Attrazione').should('be.visible');
    return cy.wrap(trip.id as string);
  });
}

/** Attività salvata sul backend (l'unica del viaggio). */
function savedActivity(tripId: string, assert: (activity: any) => void) {
  return cy.apiUntil('admin', `/api/v1/trips/${tripId}`, trip => {
    expect(trip.activities).to.have.length(1);
    assert(trip.activities[0]);
  });
}

function options(inputId: string) {
  return cy.get(`#${inputId}-options [role="option"]`);
}

describe('Attrazioni – autocompletamento del luogo', () => {
  beforeEach(() => {
    cy.login('admin');
  });

  it('suggerisce i luoghi vicini alla destinazione e la scelta col mouse compila nome, indirizzo e coordinate', () => {
    openActivityModal().then(tripId => {
      cy.intercept('GET', '/api/v1/places/poi*').as('poi');
      // Sotto i 3 caratteri nessuna ricerca.
      cy.get('#act_name').type('Sa');
      cy.wait(600);
      cy.get('#act_name-options').should('not.exist');

      cy.get('#act_name').type('grada');
      cy.wait('@poi').its('request.query').should('deep.include', {
        q: 'Sagrada', lat: String(BARCELLONA.lat), lng: String(BARCELLONA.lng), lang: 'it',
      });
      cy.get('#act_name').should('have.attr', 'role', 'combobox').and('have.attr', 'aria-expanded', 'true');
      // I luoghi di Barcellona prima di quello di Sabadell.
      options('act_name').should('have.length', 3);
      options('act_name').first().should('contain', BASILICA.name).and('contain', BASILICA.address)
        .and('have.attr', 'aria-selected', 'true');
      options('act_name').last().should('contain', 'Sabadell');
      cy.contains('.poi-attribution', 'OpenStreetMap contributors').should('be.visible')
        .find('a').should('have.attr', 'href', 'https://www.openstreetmap.org/copyright');

      // Il backend chiede a Photon la priorità vicino alla destinazione, senza "it" (non supportato).
      cy.request(STUB_STATE).its('body.poi').then((calls: any[]) => {
        const call = calls.find(c => c.q === 'Sagrada' && c.lat === String(BARCELLONA.lat));
        expect(call, 'ricerca su Photon con la posizione').to.exist;
        expect(call).to.include({ lon: String(BARCELLONA.lng), lang: null });
        expect(call.userAgent).to.match(/^WanderBite\//);
      });

      options('act_name').contains(BASILICA.name).click();
      cy.get('#act_name-options').should('not.exist');
      cy.get('#act_name').should('have.value', BASILICA.name);
      cy.get('#act_address').should('have.value', BASILICA.address);

      cy.contains('button', 'Salva Attrazione').click();
      cy.toast(`Attrazione "${BASILICA.name}" aggiunta!`).should('be.visible');
      savedActivity(tripId, a => {
        expect(a).to.include({ name: BASILICA.name, address: BASILICA.address });
        expect(a.coordinates).to.deep.equal({ lat: BASILICA.lat, lng: BASILICA.lng });
      });
    });
  });

  it('si usa da tastiera: frecce, Esc (senza chiudere la modale) e Invio dal campo indirizzo', () => {
    openActivityModal().then(tripId => {
      cy.get('#act_address').type('Sagrada');
      options('act_address').should('have.length', 3).first().should('have.attr', 'aria-selected', 'true');

      cy.get('#act_address').type('{downArrow}');
      options('act_address').eq(1).should('have.attr', 'aria-selected', 'true').invoke('attr', 'id').then(id => {
        cy.get('#act_address').should('have.attr', 'aria-activedescendant', id);
      });
      cy.get('#act_address').type('{downArrow}{downArrow}{upArrow}');
      options('act_address').eq(1).should('have.attr', 'aria-selected', 'true');

      // Esc chiude solo l'elenco; freccia giù lo riapre.
      cy.get('#act_address').type('{esc}');
      cy.get('#act_address-options').should('not.exist');
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('#act_address').type('{downArrow}');
      options('act_address').eq(1).should('have.attr', 'aria-selected', 'true');

      // Invio sceglie (senza inviare il form): indirizzo e, visto che era vuoto, nome.
      cy.get('#act_address').type('{enter}');
      cy.get('#act_address-options').should('not.exist');
      cy.get('[role="dialog"]').should('be.visible');
      cy.get('#act_address').should('have.value', FERMATA.address);
      cy.get('#act_name').should('have.value', FERMATA.name);

      cy.contains('button', 'Salva Attrazione').click();
      cy.toast(`Attrazione "${FERMATA.name}" aggiunta!`).should('be.visible');
      savedActivity(tripId, a => {
        expect(a.coordinates).to.deep.equal({ lat: FERMATA.lat, lng: FERMATA.lng });
      });
    });
  });

  it('dal campo indirizzo non sovrascrive un nome già scritto; modificare l\'indirizzo a mano azzera le coordinate', () => {
    openActivityModal().then(tripId => {
      cy.get('#act_name').type('La mia basilica');
      cy.get('#act_address').type('Sagrada');
      options('act_address').contains(BASILICA.name).click();
      cy.get('#act_name').should('have.value', 'La mia basilica');
      cy.get('#act_address').should('have.value', BASILICA.address).type(', ingresso nord');

      cy.contains('button', 'Salva Attrazione').click();
      cy.toast('Attrazione "La mia basilica" aggiunta!').should('be.visible');
      savedActivity(tripId, a => {
        expect(a.address).to.equal(`${BASILICA.address}, ingresso nord`);
        expect(a.coordinates ?? null, 'nessuna coordinata').to.equal(null);
      });
    });
  });

  it('senza coordinate della destinazione i risultati non hanno priorità per vicinanza', () => {
    openActivityModal(false).then(() => {
      cy.intercept('GET', '/api/v1/places/poi*').as('poi');
      cy.get('#act_name').type('Sagrada');
      cy.wait('@poi').its('request.query').should('not.have.property', 'lat');
      options('act_name').first().should('contain', 'Sabadell');
    });
  });

  it('servizio non disponibile: nessun suggerimento né errore, inserimento manuale', () => {
    openActivityModal().then(tripId => {
      cy.intercept('GET', '/api/v1/places/poi*').as('poi');
      // Photon risponde 503: il backend restituisce un elenco vuoto.
      cy.get('#act_name').type('Museo offline');
      cy.wait('@poi').its('response.body').should('deep.equal', { enabled: true, results: [] });
      cy.get('#act_name-options').should('not.exist');

      // Anche il nostro backend in errore: il campo resta a testo libero, senza console.error.
      cy.intercept('GET', '/api/v1/places/poi*', { statusCode: 500, body: {} }).as('poiDown');
      cy.get('#act_address').type('Via Inventata 1');
      cy.wait('@poiDown');
      cy.get('#act_address-options').should('not.exist');

      cy.contains('button', 'Salva Attrazione').click();
      cy.toast('Attrazione "Museo offline" aggiunta!').should('be.visible');
      savedActivity(tripId, a => {
        expect(a).to.include({ name: 'Museo offline', address: 'Via Inventata 1' });
        expect(a.coordinates ?? null).to.equal(null);
      });
    });
  });

  it('su mobile i suggerimenti sono leggibili e si scelgono con un tocco', () => {
    cy.viewport('iphone-x');
    openActivityModal().then(tripId => {
      cy.get('#act_name').should('have.css', 'font-size', '16px').type('Sagrada');
      options('act_name').first().should('be.visible').find('strong').should('have.css', 'font-size', '16px');
      cy.contains('.poi-attribution', 'OpenStreetMap contributors').should('be.visible');
      options('act_name').first().click();
      cy.get('#act_address').should('have.value', BASILICA.address);
      cy.contains('button', 'Salva Attrazione').click();
      savedActivity(tripId, a => {
        expect(a.coordinates).to.deep.equal({ lat: BASILICA.lat, lng: BASILICA.lng });
      });
    });
  });
});

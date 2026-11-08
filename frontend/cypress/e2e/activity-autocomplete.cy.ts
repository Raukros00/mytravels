import { uniq } from '../support/e2e';
import { GROUPS } from '../support/users';

/**
 * Autocompletamento di nome e indirizzo delle attrazioni (Wikidata e Photon/OpenStreetMap tramite il backend).
 * I servizi sono finti (e2e/api-stubs.py): su Photon "Sagrada" trova la Sagrada Familia di Sabadell (prima
 * senza posizione), la Basílica e la fermata "Sagrada Família" di Barcellona; su Wikidata "Torre Eiffel"
 * trova la torre di Parigi (Q243), una canzone senza coordinate e un omonimo in Messico. "offline" risponde 503.
 */
const STUB = 'http://127.0.0.1:18090';
const STUB_STATE = `${STUB}/__state`;
const BARCELLONA = { lat: 41.38879, lng: 2.15899 };
const PARIGI = { lat: 48.85341, lng: 2.3488 };
const ROMA = { lat: 41.89193, lng: 12.51133 };
const TORRE_EIFFEL = {
  name: 'Torre Eiffel',
  localName: 'Tour Eiffel',
  address: 'Avenue Anatole France 5, 75007 Paris, France',
  lat: 48.858222,
  lng: 2.2945,
};
const DESTINATIONS = {
  barcellona: { destination: 'Barcellona', country: 'Spagna', destinationPlaceId: '3128760', destinationIntlName: 'Barcelona', destinationLat: BARCELLONA.lat, destinationLng: BARCELLONA.lng },
  parigi: { destination: 'Parigi', country: 'Francia', destinationPlaceId: '2988507', destinationIntlName: 'Paris', destinationLat: PARIGI.lat, destinationLng: PARIGI.lng },
  roma: { destination: 'Roma', country: 'Italia', destinationPlaceId: '3169070', destinationIntlName: 'Rome', destinationLat: ROMA.lat, destinationLng: ROMA.lng },
};
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

/** Viaggio con la destinazione scelta dall'elenco (con coordinate) o, con `null`, scritta a mano (senza). */
function openActivityModal(where: keyof typeof DESTINATIONS | null = 'barcellona') {
  const title = uniq('E2E Luoghi');
  const place = where ? DESTINATIONS[where] : { destination: 'Barcellona', country: 'Spagna' };
  return cy.createTrip('admin', GROUPS.esploratori, { title, ...place }).then(trip => {
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
        .find('a').first().should('have.attr', 'href', 'https://www.openstreetmap.org/copyright');

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
    openActivityModal(null).then(() => {
      cy.intercept('GET', '/api/v1/places/poi*').as('poi');
      cy.get('#act_name').type('Sagrada');
      cy.wait('@poi').its('request.query').should('not.have.property', 'lat');
      options('act_name').first().should('contain', 'Sabadell');
      // Nessuna area da limitare: niente bbox.
      cy.request(STUB_STATE).its('body.poi').then((calls: any[]) => {
        const call = calls.filter(c => c.q === 'Sagrada' && c.lat === null).pop();
        expect(call, 'ricerca su Photon senza posizione').to.exist;
        expect(call.bbox).to.equal(null);
      });
    });
  });

  it('servizio non disponibile: nessun suggerimento né errore, inserimento manuale', () => {
    openActivityModal().then(tripId => {
      cy.intercept('GET', '/api/v1/places/poi*').as('poi');
      // Photon e Wikidata rispondono 503: il backend restituisce un elenco vuoto.
      cy.get('#act_name').type('Museo offline');
      cy.wait('@poi').its('response.body').should('deep.equal', { enabled: true, results: [] });
      cy.get('#act_name-options').should('not.exist');
      cy.request(STUB_STATE).its('body.wikidata').then((calls: any[]) => {
        expect(calls.some(c => c.search === 'Museo offline'), 'Wikidata interrogato').to.equal(true);
      });

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

describe('Attrazioni – ricerca in italiano e area della destinazione', () => {
  beforeEach(() => {
    cy.request(`${STUB}/__fail`);
    cy.login('admin');
  });

  afterEach(() => {
    cy.request(`${STUB}/__fail`);
  });

  it('trova il monumento con il nome italiano (Wikidata) e l\'indirizzo; esclude i risultati fuori area', () => {
    openActivityModal('parigi').then(tripId => {
      cy.intercept('GET', '/api/v1/places/poi*').as('poi');
      cy.get('#act_name').type('Torre Eiffel');
      cy.wait('@poi');

      // Solo la torre di Parigi: l'omonimo in Messico (Wikidata e Photon) e la canzone senza coordinate no.
      options('act_name').should('have.length', 1).first().within(() => {
        cy.get('strong').should('have.text', TORRE_EIFFEL.name);
        cy.get('.poi-option-local').should('have.text', TORRE_EIFFEL.localName);
        // Indirizzo dal reverse geocoding, senza il nome del locale vicino.
        cy.get('.poi-option-address').should('have.text', TORRE_EIFFEL.address);
      });
      cy.get('#act_name-options').should('not.contain', 'Aguascalientes').and('not.contain', 'Jules Verne');
      cy.contains('.poi-attribution', 'OpenStreetMap contributors').should('contain', 'Wikidata')
        .contains('a', 'Wikidata').should('have.attr', 'href', 'https://www.wikidata.org/');

      cy.request(STUB_STATE).its('body').then((s: any) => {
        // Photon: area limitata attorno alla destinazione (bbox di ~40 km), non solo una priorità.
        const photon = s.poi.filter((c: any) => c.q === 'Torre Eiffel').pop();
        expect(photon, 'ricerca su Photon').to.exist;
        const [minLon, minLat, maxLon, maxLat] = photon.bbox.split(',').map(Number);
        expect(minLon).to.be.lessThan(PARIGI.lng);
        expect(maxLon).to.be.greaterThan(PARIGI.lng);
        expect(minLat).to.be.lessThan(PARIGI.lat);
        expect(maxLat).to.be.greaterThan(PARIGI.lat);
        expect(maxLat - minLat).to.be.within(0.6, 0.9);
        // Wikidata: ricerca in italiano, poi coordinate ed etichette, con lo User-Agent dell'app.
        const search = s.wikidata.filter((c: any) => c.action === 'wbsearchentities' && c.search === 'Torre Eiffel').pop();
        expect(search, 'ricerca su Wikidata').to.include({ language: 'it', uselang: 'it', type: 'item', format: 'json' });
        expect(search.userAgent).to.match(/^WanderBite\//);
        const entities = s.wikidata.filter((c: any) => c.action === 'wbgetentities' && c.ids.includes('Q243')).pop();
        expect(entities, 'entità Wikidata').to.exist;
        expect(entities.props).to.equal('claims|labels');
        expect(entities.languages.split('|')).to.include.members(['it', 'fr']);
        // Indirizzo chiesto solo per il risultato nell'area.
        expect(s.reverse.some((r: any) => r.lat === TORRE_EIFFEL.lat && r.lon === TORRE_EIFFEL.lng)).to.equal(true);
        expect(s.reverse.some((r: any) => r.lat < 30)).to.equal(false);
      });

      options('act_name').first().click();
      cy.get('#act_name').should('have.value', TORRE_EIFFEL.name);
      cy.get('#act_address').should('have.value', TORRE_EIFFEL.address);
      cy.contains('button', 'Salva Attrazione').click();
      cy.toast(`Attrazione "${TORRE_EIFFEL.name}" aggiunta!`).should('be.visible');
      savedActivity(tripId, a => {
        expect(a).to.include({ name: TORRE_EIFFEL.name, address: TORRE_EIFFEL.address });
        expect(a.coordinates).to.deep.equal({ lat: TORRE_EIFFEL.lat, lng: TORRE_EIFFEL.lng });
      });
    });
  });

  it('lo stesso luogo da Wikidata e da Photon compare una volta sola, con il nome italiano', () => {
    openActivityModal('parigi').then(() => {
      // Photon trova "Tour Eiffel" (a pochi metri dall'entità Wikidata) e il liceo a ~1 km.
      cy.get('#act_name').type('Eiffel');
      options('act_name').should('have.length', 2);
      options('act_name').eq(0).find('strong').should('have.text', TORRE_EIFFEL.name);
      options('act_name').eq(0).find('.poi-option-local').should('have.text', TORRE_EIFFEL.localName);
      options('act_name').eq(1).find('strong').should('have.text', 'Lycée Gustave Eiffel');
      options('act_name').eq(1).find('.poi-option-local').should('not.exist');
    });
  });

  it('a Roma "Colosseo" dà un solo risultato, senza nome locale (è già italiano)', () => {
    openActivityModal('roma').then(() => {
      cy.get('#act_address').type('Colosseo');
      options('act_address').should('have.length', 1).first().within(() => {
        cy.get('strong').should('have.text', 'Colosseo');
        cy.get('.poi-option-local').should('not.exist');
        cy.get('.poi-option-address').should('have.text', 'Piazza del Colosseo, 00184 Roma, Italia');
      });
    });
  });

  it('Wikidata non disponibile: restano i risultati di Photon, senza errori', () => {
    cy.request(`${STUB}/__fail?service=wikidata`);
    openActivityModal('parigi').then(tripId => {
      cy.get('#act_name').type('Tour Eiffel');
      options('act_name').should('have.length', 1).first().within(() => {
        cy.get('strong').should('have.text', 'Tour Eiffel');
        cy.get('.poi-option-address').should('have.text', TORRE_EIFFEL.address);
      });
      cy.request(STUB_STATE).its('body.wikidata').then((calls: any[]) => {
        expect(calls.some(c => c.search === 'Tour Eiffel'), 'Wikidata interrogato').to.equal(true);
      });
      options('act_name').first().click();
      cy.contains('button', 'Salva Attrazione').click();
      cy.toast('Attrazione "Tour Eiffel" aggiunta!').should('be.visible');
      savedActivity(tripId, a => {
        expect(a).to.include({ name: 'Tour Eiffel', address: TORRE_EIFFEL.address });
      });
    });
  });
});

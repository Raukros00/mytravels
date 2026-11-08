/**
 * CORS del backend (#75): solo le origini dell'app (prod, test, sviluppo locale ed e2e) sono consentite.
 * Le richieste vanno direttamente al backend e2e (non tramite il proxy di ng serve), con l'header
 * Origin impostato a mano come farebbe il browser.
 */
const BACKEND = 'http://127.0.0.1:18083';
const ALLOWED = ['http://127.0.0.1:4300', 'https://test.alessandrodominici.dev', 'https://wanderbite.alessandrodominici.dev'];
const FORBIDDEN = 'https://evil.example';

function preflight(origin: string, path = '/auth/login', method = 'POST') {
  return cy.request({
    method: 'OPTIONS',
    url: `${BACKEND}${path}`,
    failOnStatusCode: false,
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
}

describe('Sicurezza – CORS', () => {
  it('un\'origine non in elenco: preflight rifiutata e nessun Access-Control-Allow-Origin', () => {
    preflight(FORBIDDEN).then(res => {
      expect(res.status).to.eq(403);
      expect(res.headers).not.to.have.property('access-control-allow-origin');
    });
    preflight(FORBIDDEN, '/api/v1/groups', 'GET').then(res => {
      expect(res.status).to.eq(403);
      expect(res.headers).not.to.have.property('access-control-allow-origin');
    });
  });

  it('un\'origine non in elenco non riceve la risposta di una richiesta autenticata', () => {
    cy.apiToken('admin').then(token => {
      cy.request({
        url: `${BACKEND}/api/v1/groups`,
        failOnStatusCode: false,
        headers: { Origin: FORBIDDEN, Authorization: `Bearer ${token}` },
      }).then(res => {
        expect(res.status).to.eq(403);
        expect(res.headers).not.to.have.property('access-control-allow-origin');
      });
    });
  });

  it('le origini dell\'app sono consentite, senza credenziali CORS', () => {
    ALLOWED.forEach(origin => {
      preflight(origin).then(res => {
        expect(res.status, origin).to.eq(200);
        expect(res.headers['access-control-allow-origin'], origin).to.eq(origin);
        expect(res.headers['access-control-allow-methods'], origin).to.contain('POST');
        // Il token è nell'header Authorization: nessun cookie, quindi niente allow-credentials.
        expect(res.headers, origin).not.to.have.property('access-control-allow-credentials');
      });
    });
  });

  it('una richiesta autenticata da un\'origine consentita risponde con l\'header CORS', () => {
    cy.apiToken('admin').then(token => {
      cy.request({
        url: `${BACKEND}/api/v1/groups`,
        headers: { Origin: 'http://127.0.0.1:4300', Authorization: `Bearer ${token}` },
      }).then(res => {
        expect(res.status).to.eq(200);
        expect(res.headers['access-control-allow-origin']).to.eq('http://127.0.0.1:4300');
      });
    });
  });

  it('il browser dell\'app (origine 127.0.0.1:4300) può chiamare il backend anche direttamente', () => {
    cy.login('admin');
    cy.visit('/');
    cy.window()
      .then(win => win.fetch(`${BACKEND}/actuator/health`).then(r => r.json()))
      .its('status')
      .should('eq', 'UP');
  });
});

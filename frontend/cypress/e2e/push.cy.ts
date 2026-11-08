import { E2E_VAPID_PUBLIC_KEY, PushDevice, newDevice, receivedPushes, subscribeDevice } from '../support/push';
import { DemoUser } from '../support/users';

/**
 * Infrastruttura Web Push del backend (#94): chiave pubblica, abbonamenti dei dispositivi e invio.
 * Il push service è finto (e2e/api-stubs.py): i messaggi vengono decifrati e la firma VAPID verificata.
 */

/** Richiesta autenticata che non fallisce sugli status di errore, per verificarli. */
function rawApi(user: DemoUser, method: string, url: string, body?: Cypress.RequestBody) {
  return cy.apiToken(user).then(token =>
    cy.request({ method, url, body, failOnStatusCode: false, headers: { Authorization: `Bearer ${token}` } }),
  );
}

const endpoints = (list: any[]) => list.map(s => s.endpoint);

describe('Notifiche push – infrastruttura (backend)', () => {
  it('espone la chiave pubblica VAPID solo agli utenti autenticati', () => {
    cy.api('admin', 'GET', '/api/v1/push/public-key').should('deep.equal', {
      enabled: true,
      publicKey: E2E_VAPID_PUBLIC_KEY,
    });
    cy.request({ url: '/api/v1/push/public-key', failOnStatusCode: false }).its('status').should('be.oneOf', [401, 403]);
    cy.request({ method: 'POST', url: '/api/v1/push/subscriptions', body: {}, failOnStatusCode: false })
      .its('status').should('be.oneOf', [401, 403]);
  });

  it('salva, aggiorna e cancella l\'abbonamento del dispositivo, solo per l\'utente corrente', () => {
    subscribeDevice('luca', { lang: 'en' }).then(device => {
      cy.api<any[]>('luca', 'GET', '/api/v1/push/subscriptions').then(list => {
        const mine = list.find(s => s.endpoint === device.endpoint);
        expect(mine, 'abbonamento salvato').to.exist;
        expect(mine.lang).to.eq('en');
        expect(mine).not.to.have.any.keys('p256dh', 'auth');
      });

      // Stesso endpoint con chiavi nuove (es. dopo un rinnovo del browser): aggiornato, non duplicato.
      newDevice().then(fresh => {
        cy.api('luca', 'POST', '/api/v1/push/subscriptions', { endpoint: device.endpoint, keys: fresh.keys, lang: 'it' });
      });
      cy.api<any[]>('luca', 'GET', '/api/v1/push/subscriptions').then(list => {
        const same = list.filter(s => s.endpoint === device.endpoint);
        expect(same).to.have.length(1);
        expect(same[0].lang).to.eq('it');
      });

      // Un altro utente non vede né cancella l'abbonamento di Luca.
      cy.api<any[]>('giulia', 'GET', '/api/v1/push/subscriptions').then(list => {
        expect(endpoints(list)).not.to.include(device.endpoint);
      });
      rawApi('giulia', 'DELETE', '/api/v1/push/subscriptions', { endpoint: device.endpoint }).its('status').should('eq', 204);
      cy.api<any[]>('luca', 'GET', '/api/v1/push/subscriptions').then(list => {
        expect(endpoints(list)).to.include(device.endpoint);
      });

      // Cancellazione da parte del proprietario (idempotente).
      rawApi('luca', 'DELETE', '/api/v1/push/subscriptions', { endpoint: device.endpoint }).its('status').should('eq', 204);
      rawApi('luca', 'DELETE', `/api/v1/push/subscriptions?endpoint=${encodeURIComponent(device.endpoint)}`)
        .its('status').should('eq', 204);
      cy.api<any[]>('luca', 'GET', '/api/v1/push/subscriptions').then(list => {
        expect(endpoints(list)).not.to.include(device.endpoint);
      });
    });
  });

  it('se sullo stesso dispositivo accede un altro utente, l\'abbonamento passa a lui', () => {
    subscribeDevice('sofia').then(device => {
      cy.api('marco', 'POST', '/api/v1/push/subscriptions', { endpoint: device.endpoint, keys: device.keys });
      cy.api<any[]>('sofia', 'GET', '/api/v1/push/subscriptions').then(list => {
        expect(endpoints(list)).not.to.include(device.endpoint);
      });
      cy.api<any[]>('marco', 'GET', '/api/v1/push/subscriptions').then(list => {
        expect(endpoints(list)).to.include(device.endpoint);
      });
      rawApi('marco', 'DELETE', '/api/v1/push/subscriptions', { endpoint: device.endpoint });
    });
  });

  it('rifiuta abbonamenti non validi', () => {
    newDevice().then((device: PushDevice) => {
      const bad = [
        { keys: device.keys },
        { endpoint: 'ftp://push.example.com/x', keys: device.keys },
        { endpoint: device.endpoint, keys: { p256dh: 'abc', auth: device.keys.auth } },
        { endpoint: device.endpoint, keys: { p256dh: device.keys.p256dh, auth: 'x' } },
        { endpoint: device.endpoint },
      ];
      bad.forEach(body => rawApi('luca', 'POST', '/api/v1/push/subscriptions', body).its('status').should('eq', 400));
      rawApi('luca', 'DELETE', '/api/v1/push/subscriptions').its('status').should('eq', 400);
    });
  });

  it('invia la notifica a tutti i dispositivi dell\'utente, cifrata, firmata e nella loro lingua', () => {
    subscribeDevice('giulia', { prefix: 'phone' }).then(phone => {
      subscribeDevice('giulia', { prefix: 'laptop', lang: 'en' }).then(laptop => {
        const started = Date.now();
        cy.api('giulia', 'POST', '/api/v1/push/test').then(body => {
          expect(body.devices).to.be.at.least(2);
          // L'invio è asincrono: la risposta non aspetta il push service.
          expect(Date.now() - started).to.be.lessThan(3000);
        });

        receivedPushes(phone).then(([msg]) => {
          expect(msg.status).to.eq(201);
          expect(msg.headers['Content-Encoding']).to.eq('aes128gcm');
          expect(msg.headers.TTL).to.eq('86400');
          expect(msg.headers.Urgency).to.eq('normal');
          expect(msg.headers.Topic).to.match(/^[A-Za-z0-9_-]{1,32}$/);
          expect(msg.vapid.aud).to.eq('http://api-stubs:8000');
          expect(msg.vapid.sub).to.eq('mailto:e2e@example.com');
          expect(msg.vapid.exp * 1000).to.be.greaterThan(Date.now());
          expect(msg.vapid.exp * 1000).to.be.at.most(Date.now() + 24 * 3600 * 1000);

          const n = msg.payload.notification;
          expect(n.title).to.eq('WanderBite');
          expect(n.body).to.eq('Le notifiche sono attive su questo dispositivo.');
          expect(n.tag).to.eq('test');
          expect(n.icon).to.eq('/icons/icon-192x192.png');
          expect(n.data.url).to.eq('/profile');
          // Formato del service worker di Angular: al tocco apre l'app sulla pagina indicata.
          expect(n.data.onActionClick.default).to.deep.equal({ operation: 'navigateLastFocusedOrOpen', url: '/profile' });
        });
        receivedPushes(laptop).then(([msg]) => {
          expect(msg.payload.notification.body).to.eq('Notifications are on for this device.');
        });

        cy.apiUntil<any[]>('giulia', '/api/v1/push/subscriptions', list => {
          const phoneSub = list.find(s => s.endpoint === phone.endpoint);
          expect(phoneSub.lastUsedAt, 'ultimo invio registrato').to.be.a('string');
        });
      });
    });
  });

  it('cancella gli abbonamenti scaduti (404/410) e mantiene quelli con errori temporanei', () => {
    subscribeDevice('marco', { prefix: 'gone' }).then(gone => {
      subscribeDevice('marco', { prefix: 'missing' }).then(missing => {
        subscribeDevice('marco', { prefix: 'fail' }).then(failing => {
          cy.api('marco', 'POST', '/api/v1/push/test');
          receivedPushes(gone).its('0.status').should('eq', 410);
          receivedPushes(missing).its('0.status').should('eq', 404);
          receivedPushes(failing).its('0.status').should('eq', 500);
          cy.apiUntil<any[]>('marco', '/api/v1/push/subscriptions', list => {
            expect(endpoints(list)).not.to.include(gone.endpoint);
            expect(endpoints(list)).not.to.include(missing.endpoint);
          });
          cy.api<any[]>('marco', 'GET', '/api/v1/push/subscriptions').then(list => {
            expect(endpoints(list)).to.include(failing.endpoint);
          });
          rawApi('marco', 'DELETE', '/api/v1/push/subscriptions', { endpoint: failing.endpoint });
        });
      });
    });
  });
});

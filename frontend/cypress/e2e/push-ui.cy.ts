import itJson from '../../public/i18n/it.json';
import { E2E_VAPID_PUBLIC_KEY, PushDevice, newDevice, receivedPushes, subscribeDevice } from '../support/push';

/**
 * Notifiche push dall'app (#95): interruttore nel Profilo, stati, permesso solo dopo un tocco,
 * istruzioni per iPhone, logout/login.
 *
 * Con `ng serve` il service worker non è attivo: SwPush viene sostituito da un client finto
 * (`window.__e2ePushClient`, letto solo in sviluppo) e Notification/PushManager sono simulati.
 * Il client finto restituisce un dispositivo con chiavi vere e endpoint del finto push service:
 * la notifica di prova arriva davvero allo stub e viene decifrata.
 */
const t = itJson.profile;

type Permission = 'default' | 'granted' | 'denied';

interface FakeOptions {
  device?: PushDevice;
  permission?: Permission;
  /** Abbonamento già presente nel browser (es. push attivate in precedenza). */
  subscribed?: boolean;
  /** Il browser nega il permesso quando viene chiesto. */
  denyOnPrompt?: boolean;
  /** Preferenza "push attive su questo dispositivo" salvata in precedenza. */
  pref?: boolean;
  userAgent?: string;
  standalone?: boolean;
  /** false = nessun client finto: SwPush reale, disattivato con ng serve. */
  client?: boolean;
}

interface Fake {
  calls: { requestSubscription: string[]; unsubscribe: number; requestPermission: number };
}

/** Visita `url` con Notification, PushManager e SwPush simulati. */
function visitWithPush(url: string, opts: FakeOptions = {}): Cypress.Chainable<Fake> {
  const fake: Fake = { calls: { requestSubscription: [], unsubscribe: 0, requestPermission: 0 } };
  const state = { permission: opts.permission ?? 'default', subscribed: !!opts.subscribed };
  const subscription = () => {
    const device = opts.device!;
    return {
      endpoint: device.endpoint,
      expirationTime: null,
      toJSON: () => ({ endpoint: device.endpoint, expirationTime: null, keys: device.keys }),
    } as unknown as PushSubscription;
  };

  return cy
    .visit(url, {
      onBeforeLoad(win) {
        if (opts.pref) win.localStorage.setItem('wb_push', 'on');
        if (opts.userAgent) Object.defineProperty(win.navigator, 'userAgent', { value: opts.userAgent });
        if (opts.userAgent?.includes('iPhone')) Object.defineProperty(win.navigator, 'maxTouchPoints', { value: 5 });
        if (opts.standalone) Object.defineProperty(win.navigator, 'standalone', { value: true });

        const FakeNotification = function () {} as unknown as { permission: Permission; requestPermission: () => Promise<Permission> };
        Object.defineProperty(FakeNotification, 'permission', { get: () => state.permission });
        FakeNotification.requestPermission = () => {
          fake.calls.requestPermission++;
          return Promise.resolve(state.permission);
        };
        Object.defineProperty(win, 'Notification', { value: FakeNotification, configurable: true, writable: true });
        if (!('PushManager' in win)) Object.defineProperty(win, 'PushManager', { value: function () {}, configurable: true });

        if (opts.client === false) return;
        (win as any).__e2ePushClient = {
          isEnabled: true,
          // Come PushManager.subscribe: è qui che il browser mostra la richiesta di permesso.
          requestSubscription({ serverPublicKey }: { serverPublicKey: string }) {
            fake.calls.requestSubscription.push(serverPublicKey);
            if (state.permission !== 'granted') {
              fake.calls.requestPermission++;
              if (opts.denyOnPrompt) {
                state.permission = 'denied';
                return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
              }
              state.permission = 'granted';
            }
            state.subscribed = true;
            return Promise.resolve(subscription());
          },
          unsubscribe() {
            fake.calls.unsubscribe++;
            if (!state.subscribed) return Promise.reject(new Error('Not subscribed to push notifications.'));
            state.subscribed = false;
            return Promise.resolve();
          },
          currentSubscription: () => Promise.resolve(state.subscribed ? subscription() : null),
        };
      },
    })
    .then(() => fake);
}

const section = () => cy.contains('.section-card .section-title', t.push_title).closest('.section-card');
// L'interruttore del dispositivo: con le notifiche attive compaiono anche quelli delle preferenze (#97).
const toggle = () => section().find('button.push-switch[role="switch"]');
const endpoints = (list: any[]) => list.map(s => s.endpoint);

describe('Notifiche push – attivazione dall\'app', () => {
  beforeEach(() => cy.login('sofia'));

  it('attiva e disattiva dal Profilo: il permesso si chiede solo al tocco, la notifica di prova arriva', () => {
    cy.intercept('POST', '/api/v1/push/subscriptions').as('subscribe');
    cy.intercept('DELETE', '/api/v1/push/subscriptions').as('unsubscribe');
    newDevice('ui').then(device => {
      visitWithPush('/profile', { device }).then(fake => {
        section().should('contain.text', t.push_desc);
        toggle().should('have.attr', 'aria-checked', 'false');
        section().should('contain.text', t.push_status_off);
        // Nessuna richiesta di permesso all'apertura della pagina.
        cy.wrap(fake.calls).its('requestPermission').should('eq', 0);
        cy.wrap(fake.calls).its('requestSubscription').should('have.length', 0);

        toggle().click();
        cy.wrap(fake.calls).its('requestSubscription').should('deep.equal', [E2E_VAPID_PUBLIC_KEY]);
        cy.wait('@subscribe').its('request.body').should('deep.include', {
          endpoint: device.endpoint, keys: device.keys, lang: 'it',
        });
        cy.toast(t.push_enabled_toast).should('be.visible');
        toggle().should('have.attr', 'aria-checked', 'true');
        section().should('contain.text', t.push_status_on);
        cy.apiUntil<any[]>('sofia', '/api/v1/push/subscriptions', list => {
          expect(endpoints(list)).to.include(device.endpoint);
        });

        // Notifica di prova: arriva al push service con il link al profilo.
        cy.contains('button', t.push_test).click();
        cy.toast(t.push_test_sent).should('be.visible');
        receivedPushes(device).then(([msg]) => {
          expect(msg.payload.notification.body).to.eq('Le notifiche sono attive su questo dispositivo.');
          expect(msg.payload.notification.data.onActionClick.default).to.deep.equal({
            operation: 'navigateLastFocusedOrOpen', url: '/profile',
          });
        });

        toggle().click();
        cy.wait('@unsubscribe').its('request.body').should('deep.equal', { endpoint: device.endpoint });
        cy.wrap(fake.calls).its('unsubscribe').should('eq', 1);
        cy.toast(t.push_disabled_toast).should('be.visible');
        toggle().should('have.attr', 'aria-checked', 'false');
        cy.contains('button', t.push_test).should('not.exist');
        cy.apiUntil<any[]>('sofia', '/api/v1/push/subscriptions', list => {
          expect(endpoints(list)).not.to.include(device.endpoint);
        });
      });
    });
  });

  it('non chiede mai il permesso all\'avvio dell\'app', () => {
    newDevice('boot').then(device => {
      visitWithPush('/dashboard', { device }).then(fake => {
        cy.get('app-navbar').should('exist');
        cy.wait(500);
        cy.wrap(fake.calls).its('requestPermission').should('eq', 0);
        cy.wrap(fake.calls).its('requestSubscription').should('have.length', 0);
      });
    });
  });

  it('permesso già negato: spiega come riattivarlo, senza interruttore', () => {
    newDevice('denied').then(device => {
      visitWithPush('/profile', { device, permission: 'denied' });
      section().should('contain.text', t.push_denied_title).and('contain.text', t.push_denied_hint);
      toggle().should('not.exist');
    });
  });

  it('permesso negato quando il browser lo chiede: mostra lo stato "bloccate"', () => {
    cy.intercept('POST', '/api/v1/push/subscriptions').as('subscribe');
    newDevice('deny').then(device => {
      visitWithPush('/profile', { device, denyOnPrompt: true }).then(fake => {
        toggle().click();
        cy.wrap(fake.calls).its('requestPermission').should('eq', 1);
        section().should('contain.text', t.push_denied_title);
        cy.get('@subscribe.all').should('have.length', 0);
      });
    });
  });

  it('browser senza supporto (service worker non attivo): messaggio chiaro', () => {
    visitWithPush('/profile', { client: false });
    section().should('contain.text', t.push_unsupported);
    toggle().should('not.exist');
  });

  it('push disattivate sul server: messaggio chiaro', () => {
    cy.intercept('GET', '/api/v1/push/public-key', { body: { enabled: false, publicKey: null } });
    newDevice('srv').then(device => {
      visitWithPush('/profile', { device });
      section().should('contain.text', t.push_server_disabled);
      toggle().should('not.exist');
    });
  });

  describe('iPhone', () => {
    const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    it('da Safari (app non installata) mostra le istruzioni "Condividi → Aggiungi alla schermata Home"', () => {
      newDevice('ios').then(device => {
        visitWithPush('/profile', { device, userAgent: IPHONE }).then(fake => {
          section().should('contain.text', t.push_ios_title)
            .and('contain.text', t.push_ios_step1)
            .and('contain.text', t.push_ios_step2)
            .and('contain.text', t.push_ios_hint);
          toggle().should('not.exist');
          cy.wrap(fake.calls).its('requestPermission').should('eq', 0);
        });
      });
    });

    it('dall\'app installata nella schermata Home mostra l\'interruttore', () => {
      newDevice('ios-app').then(device => {
        visitWithPush('/profile', { device, userAgent: IPHONE, standalone: true });
        toggle().should('be.visible').and('have.attr', 'aria-checked', 'false');
        section().should('not.contain.text', t.push_ios_title);
      });
    });
  });

  it('al logout rimuove l\'abbonamento del dispositivo dal server e dal browser', () => {
    cy.intercept('DELETE', '/api/v1/push/subscriptions').as('unsubscribe');
    subscribeDevice('sofia', { prefix: 'logout' }).then(device => {
      visitWithPush('/profile', { device, permission: 'granted', subscribed: true, pref: true }).then(fake => {
        toggle().should('have.attr', 'aria-checked', 'true');
        cy.get('.logout-btn').click();
        cy.wait('@unsubscribe').then(({ request }) => {
          expect(request.body).to.deep.equal({ endpoint: device.endpoint });
          expect(request.headers.authorization).to.match(/^Bearer .+/);
        });
        cy.wrap(fake.calls).its('unsubscribe').should('eq', 1);
        cy.apiUntil<any[]>('sofia', '/api/v1/push/subscriptions', list => {
          expect(endpoints(list)).not.to.include(device.endpoint);
        });
      });
    });
  });

  it('al login ripristina l\'abbonamento se le push erano attive e il permesso è già concesso', () => {
    cy.intercept('POST', '/api/v1/push/subscriptions').as('subscribe');
    newDevice('login').then(device => {
      visitWithPush('/dashboard', { device, permission: 'granted', pref: true }).then(fake => {
        cy.wait('@subscribe').its('request.body.endpoint').should('eq', device.endpoint);
        // Nessuna richiesta visibile: il permesso era già concesso.
        cy.wrap(fake.calls).its('requestPermission').should('eq', 0);
        cy.apiUntil<any[]>('sofia', '/api/v1/push/subscriptions', list => {
          expect(endpoints(list)).to.include(device.endpoint);
        });
      });
    });
  });
});

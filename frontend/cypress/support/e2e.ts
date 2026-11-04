import './commands';

/** Nome univoco per i dati creati dai test, così gli spec non interferiscono tra loro. */
export function uniq(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

// Errore innocuo del browser (layout della mappa/scroll): non è un errore dell'app.
Cypress.on('uncaught:exception', err => {
  if (err.message.includes('ResizeObserver loop')) return false;
  return undefined;
});

/**
 * Errori scritti dall'app con console.error durante il test.
 * Comprendono gli errori di Angular (es. pipe che lanciano) e le sincronizzazioni con il backend
 * fallite: l'UI è ottimistica, quindi senza questo controllo resterebbero invisibili.
 */
let appErrors: string[] = [];

Cypress.on('window:before:load', win => {
  const original = win.console.error.bind(win.console);
  win.console.error = (...args: unknown[]) => {
    appErrors.push(args.map(a => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ').slice(0, 500));
    original(...args);
  };
});

beforeEach(() => {
  appErrors = [];
  // Il service worker non è attivo con `ng serve`, ma per sicurezza nessuna cache tra un test e l'altro.
  cy.clearLocalStorage();
});

afterEach(function () {
  // Un test può dichiarare errori attesi con: cy.wrap(true).as('allowAppErrors')
  if (this.allowAppErrors) return;
  expect(appErrors, 'errori dell\'app in console').to.deep.equal([]);
});

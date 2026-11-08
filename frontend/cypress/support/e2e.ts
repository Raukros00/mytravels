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
 * Rete esterna bloccata (blockHosts in cypress.config.ts): senza il CSS di Google Fonts le icone
 * Material Symbols resterebbero parole ("notifications") larghe quanto il testo, che coprono i pulsanti
 * vicini. Questo stile riproduce l'ingombro del glifo (quadrato di 1em) come fa il CSS originale.
 */
const ICON_FONT_SHIM = `
.material-symbols-outlined {
  display: inline-block; width: 1em; height: 1em; overflow: hidden;
  font-size: 24px; line-height: 1; white-space: nowrap; letter-spacing: normal;
  text-transform: none; word-wrap: normal; direction: ltr; vertical-align: middle;
}`;

Cypress.on('window:before:load', win => {
  win.document.addEventListener('DOMContentLoaded', () => {
    const style = win.document.createElement('style');
    style.setAttribute('data-cy', 'icon-font-shim');
    style.textContent = ICON_FONT_SHIM;
    // In testa, così le classi dell'app (es. text-[20px]) continuano a vincere sulla dimensione.
    win.document.head.prepend(style);
  });
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

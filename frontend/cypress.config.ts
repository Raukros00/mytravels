import { defineConfig } from 'cypress';

/**
 * Test end-to-end di regressione.
 * Girano contro lo stack completo: `ng serve` (porta 4300, proxy verso il backend e2e)
 * + backend/Postgres di docker-compose.e2e.yml con i dati demo.
 * Vedi cypress/README.md.
 */
export default defineConfig({
  e2e: {
    // IPv4 esplicito: sui runner Linux `localhost` può risolversi in ::1, dove ng serve non ascolta.
    baseUrl: 'http://127.0.0.1:4300',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 800,
    // Timeout espliciti: un comando o una pagina appesa fanno fallire il test invece di bloccare la run.
    defaultCommandTimeout: 8000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    pageLoadTimeout: 30000,
    video: false,
    screenshotOnRunFailure: true,
    // In run un retry assorbe eventuali flakiness; in locale (open) si vede subito il fallimento.
    retries: { runMode: 1, openMode: 0 },
    // Libera la memoria del browser tra un test e l'altro (Chromium/Electron): evita i crash su run lunghe.
    experimentalMemoryManagement: true,
    // Nessuna rete esterna: font, copertine Unsplash e tile della mappa non servono ai test e,
    // senza connessione o con una rete lenta, lascerebbero la pagina in attesa del `load`.
    blockHosts: [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      '*.unsplash.com',
      'unsplash.com',
      '*.tile.openstreetmap.org',
      'tile.openstreetmap.org',
      '*.google.com',
      '*.googleapis.com',
      '*.gstatic.com',
    ],
    setupNodeEvents(_on, config) {
      // Headless nessuno snapshot dei test passati in memoria (servono solo nel runner interattivo).
      if (!config.isInteractive) config.numTestsKeptInMemory = 0;
      return config;
    },
  },
});

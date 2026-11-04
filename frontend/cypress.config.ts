import { defineConfig } from 'cypress';

/**
 * Test end-to-end di regressione.
 * Girano contro lo stack completo: `ng serve` (porta 4300, proxy verso il backend e2e)
 * + backend/Postgres di docker-compose.e2e.yml con i dati demo.
 * Vedi cypress/README.md.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4300',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 800,
    defaultCommandTimeout: 8000,
    video: false,
    screenshotOnRunFailure: true,
    // In CI un retry assorbe eventuali flakiness di rete; in locale si vede subito il fallimento.
    retries: { runMode: 1, openMode: 0 },
  },
});

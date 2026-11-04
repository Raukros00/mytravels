# Test end-to-end (Cypress)

Test di regressione che girano sull'app completa: frontend Angular (`ng serve`) + backend Spring Boot + Postgres
con i dati demo del `DataInitializer` (`SEED_DEMO_DATA=true`). Nessuna API è mockata: ogni modifica fatta
dall'interfaccia viene anche verificata leggendo il backend.

## Avvio in locale

Serve Docker attivo. Dalla cartella `frontend/`:

```bash
npm run e2e:stack      # backend + Postgres in Docker (porta 18083), DB in tmpfs con i dati demo
npm run e2e            # avvia ng serve sulla 4300 e lancia tutta la suite headless
npm run e2e:stack:down # spegne lo stack (il DB riparte da zero al prossimo up)
```

Per scrivere o fare debug dei test:

```bash
npm run e2e:stack
npm run e2e:serve      # in un terminale
npm run cy:open        # in un altro: runner interattivo
```

`e2e:stack` ricostruisce l'immagine del backend dal codice locale, quindi testa sempre il backend del branch corrente.

## Struttura

| Spec | Copre |
| :--- | :--- |
| `auth.cy.ts` | login, errori, registrazione, sessione/logout, guard, residui della modalità mock |
| `navigation.cy.ts` | navbar desktop e mobile, menu utente, notifiche, lingua, dashboard, profilo |
| `trips.cy.ts` | lista viaggi (ricerca, filtri, eliminazione), creazione viaggio e proposta |
| `trip-detail.cy.ts` | tab itinerario, food, attività, logistica (voli/alloggio/trasporti), spese, condivisione |
| `groups.cy.ts` | lista, creazione/modifica, codice invito, lascia gruppo, dettaglio, voti, membri, impostazioni, inviti via notifica |
| `explore.cy.ts` | catalogo, ricerca e filtri, dettaglio, assegnazione di un itinerario a un gruppo |

Comandi custom in `support/commands.ts`: `cy.login(utente)`, `cy.api(...)`, `cy.apiUntil(...)`, `cy.createGroup(...)`,
`cy.createTrip(...)`, `cy.joinGroup(...)`, `cy.toast(...)`, `cy.dialog(...)`. Utenti, gruppi e viaggi demo sono in
`support/users.ts`.

## Regole per i nuovi test

- **Dati propri**: i test che modificano qualcosa creano i propri gruppi/viaggi via API con nomi univoci (`uniq()`),
  così non dipendono dall'ordine né da quanti dati hanno lasciato i test precedenti. I dati demo si usano in sola lettura.
- **Verifica sul backend con `cy.apiUntil`**: l'UI è ottimistica (il toast compare prima che la chiamata finisca),
  quindi una singola lettura via API può arrivare troppo presto.
- **Nessun errore in console**: ogni test fallisce se l'app scrive con `console.error` (eccezioni Angular,
  sincronizzazioni con il backend fallite). Se un errore è atteso: `cy.wrap(true).as('allowAppErrors')`.
- **Date**: lo stato dei viaggi dipende da oggi; dove conta, bloccare solo `Date` con `cy.clock(data, ['Date'])`.
- **Testi**: per le pagine tradotte usare le chiavi di `public/i18n/it.json` invece di copiare le frasi.

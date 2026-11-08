# Test end-to-end (Cypress)

Test di regressione che girano sull'app completa: frontend Angular (`ng serve`) + backend Spring Boot + Postgres
con i dati demo del `DataInitializer` (`SEED_DEMO_DATA=true`). Nessuna API è mockata: ogni modifica fatta
dall'interfaccia viene anche verificata leggendo il backend.

## Avvio rapido (macOS)

Dalla root del repo, un solo comando avvia tutto e apre Cypress con l'interfaccia grafica:

```bash
./scripts/e2e-ui.sh            # oppure, da frontend/: npm run e2e:ui
```

Avvia Docker Desktop se serve, installa le dipendenze se mancano, avvia lo stack e2e e l'app
Angular e apre Cypress. Chiudendo Cypress (o con Ctrl+C) spegne tutto. Opzioni:

| Opzione | Effetto |
| :--- | :--- |
| `--keep` | alla chiusura lascia acceso lo stack Docker (il riavvio successivo è più veloce) |
| `--fresh` | riparte da un database pulito con i soli dati demo |
| `--browser chrome` | usa quel browser (`chrome`, `electron`, `firefox`, `edge`) |
| `--run` | niente interfaccia: esegue tutta la suite headless |

### Run headless (`--run`): limiti di tempo e browser

- **Browser**: se non si passa `--browser`, la suite usa **Chrome** quando è installato (più stabile di Electron
  sulle run lunghe), altrimenti Electron incluso in Cypress.
- **Tempo massimo della suite**: 15 minuti (una run completa ne richiede 3–4). Se scade, un watchdog chiude
  Cypress e il browser, lo script spegne app e stack Docker ed esce con errore
  (`✖ La suite Cypress ha superato il limite di 15 minuti…`). Si cambia con `E2E_TIMEOUT_MIN`
  (es. `E2E_TIMEOUT_MIN=30 ./scripts/e2e-ui.sh --run`; `0` = nessun limite).
- **Avvio dell'app Angular**: massimo 300 s (`E2E_APP_TIMEOUT_S`). Se `ng serve` si chiude o non risponde,
  lo script mostra le ultime righe del log (`$TMPDIR/wanderbite-e2e-serve.log`) ed esce. Se la porta 4300 è
  occupata da un processo che non risponde (es. un `ng serve` rimasto appeso) lo dice subito, con il PID.
- **Niente rete esterna**: `blockHosts` in `cypress.config.ts` blocca Google Fonts, Unsplash, le tile di
  OpenStreetMap e Google; i servizi esterni del backend sono già finti (`e2e/api-stubs.py`). La suite passa anche
  offline e non resta in attesa di risorse lente.
- In run headless Cypress non tiene in memoria gli snapshot dei test passati (`numTestsKeptInMemory: 0`) e usa
  `experimentalMemoryManagement`; ogni test fallito viene ritentato una volta (`retries.runMode: 1`).

## Avvio in locale (passo per passo)

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
| `push.cy.ts` | notifiche push (backend): chiave VAPID, abbonamenti dei dispositivi, invio cifrato e pulizia degli abbonamenti scaduti |
| `push-ui.cy.ts` | notifiche push dall'app: interruttore nel profilo (SwPush/Notification simulati), stati, istruzioni iPhone, logout/login |

Comandi custom in `support/commands.ts`: `cy.login(utente)`, `cy.api(...)`, `cy.apiUntil(...)`, `cy.createGroup(...)`,
`cy.createTrip(...)`, `cy.joinGroup(...)`, `cy.toast(...)`, `cy.dialog(...)`. Utenti, gruppi e viaggi demo sono in
`support/users.ts`.

Notifiche push: `support/push.ts` crea dispositivi finti (chiavi generate con WebCrypto) abbonati con un endpoint del
finto push service dello stub (`e2e/api-stubs.py`, `GET /__push?id=...`); `receivedPushes(device)` attende i messaggi,
li decifra (aes128gcm) e verifica la firma VAPID.

## Regole per i nuovi test

- **Dati propri**: i test che modificano qualcosa creano i propri gruppi/viaggi via API con nomi univoci (`uniq()`),
  così non dipendono dall'ordine né da quanti dati hanno lasciato i test precedenti. I dati demo si usano in sola lettura.
- **Verifica sul backend con `cy.apiUntil`**: l'UI è ottimistica (il toast compare prima che la chiamata finisca),
  quindi una singola lettura via API può arrivare troppo presto.
- **Nessun errore in console**: ogni test fallisce se l'app scrive con `console.error` (eccezioni Angular,
  sincronizzazioni con il backend fallite). Se un errore è atteso: `cy.wrap(true).as('allowAppErrors')`.
- **Date**: lo stato dei viaggi dipende da oggi; dove conta, bloccare solo `Date` con `cy.clock(data, ['Date'])`.
- **Testi**: per le pagine tradotte usare le chiavi di `public/i18n/it.json` invece di copiare le frasi.

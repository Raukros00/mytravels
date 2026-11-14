# AGENTS.md – WanderBite (MyTravels)

Istruzioni per gli agenti di sviluppo (Claude Code, Codex, Cursor…) su questo repository. È la fonte unica: `CLAUDE.md` la importa. Per ambienti, porte e reverse proxy vedi `README.md`.

## Lingua
- Rispondi al proprietario **in italiano**. Testi dell'interfaccia, commit, MR, issue e commenti nel codice: in italiano.
- Testi visibili all'utente: italiano + inglese dove il componente usa le traduzioni (`translate` pipe e file i18n).

## Stack
- **Frontend** (`frontend/`): Angular 21 **zoneless**, signals, componenti standalone, Tailwind + variabili `--wb-*` in `styles.css`, PWA (`@angular/service-worker`, `ngsw-config.json`). Rotte lazy: non appesantire il bundle iniziale (usa `@defer` per modali e componenti pesanti).
- **Backend** (`backend/`): Spring Boot 3.3, Java 21, JWT (il principal è l'**email**), Flyway, Postgres 16.
- **Servizi esterni** chiamati sempre dal backend, con URL configurabile, cache, timeout corti e degrado elegante: Unsplash (copertine), GeoNames (città), Photon + Wikidata (attrazioni e indirizzi), Open-Meteo (meteo), Web Push (VAPID).

## Comandi
Usa sempre `export PATH="/opt/homebrew/bin:$PATH"`: il Node di default del Mac è troppo vecchio per Angular.

| Cosa | Comando |
|---|---|
| Build backend | `cd backend && mvn -q -DskipTests clean package` (`clean` serve se rinomini migrazioni) |
| Build frontend | `cd frontend && npm ci && npm run build -- --configuration production` |
| Unit test frontend | `cd frontend && npm run test:unit` (utility pure, fuso Europe/Rome) |
| Suite e2e completa | `./scripts/e2e-ui.sh --run` (timeout 15 min, `--help` per le opzioni) |
| Cypress con interfaccia | `./scripts/e2e-ui.sh` |

- Non esistono test backend: le API si verificano con Cypress (`cy.api`, `cy.login`, `cy.createGroup`, `cy.joinGroup`, `cy.createTrip`…, in `frontend/cypress/support/`). Ogni test fallisce se l'app scrive in `console.error`: gli errori gestiti vanno in `console.warn`.
- Lo stack e2e (`docker-compose.e2e.yml`) usa porte fisse (backend 18083, app 4300, stub 18090): una sola run alla volta. Gli stub dei servizi esterni sono in `e2e/api-stubs.py`.
- Il pre-push hook compila Angular: il push è lento, è normale.

## Regole di sviluppo
- **Sicurezza**: ogni endpoint su gruppi e viaggi passa da `GroupAccess` (non membro → 404, membro non admin dove serve l'admin → 403). Mai restituire l'entità `User`: usa il DTO senza password. Gli id delle sotto-risorse li genera il server.
- **Salvataggi**: usa gli endpoint delle singole risorse (attività, ristoranti, spese, voto), non il `PUT` dell'intero viaggio con le liste. Sugli errori: rollback locale + toast d'errore; il toast di successo solo dopo la risposta del server.
- **Date**: mai `toISOString().split('T')[0]` per la data locale; usa le utility (`todayIso`, `addDaysIso`) e l'orologio dell'app (`?now=` simula l'ora solo in sviluppo e su test).
- **Migrazioni Flyway**: subito prima di ogni MR controlla l'ultimo numero su `origin/develop` e rinumera la tua se serve. Due migrazioni con lo stesso numero bloccano l'avvio del backend (è già successo). Le migrazioni girano anche in produzione: devono essere prudenti e idempotenti, e la MR deve spiegare cosa fanno ai dati.
- **Mobile**: campi con testo ≥16px (niente zoom di iOS), barra in basso con aree sicure (`env(safe-area-inset-*)`), controlla `cypress/e2e/mobile.cy.ts`.
- **Variabili d'ambiente nuove**: dai sempre un default pubblico se possibile, aggiungile a tutti i `docker-compose*.yml` e documentale nella MR.

## Git e GitHub
- Repo: `Raukros00/mytravels`. `gh` è in `/opt/homebrew/bin/gh`.
- Branch sempre da `origin/develop` aggiornato (`feat/N-…`, `fix/N-…`). MR verso **develop**, con `Closes #N`. `main` = produzione: non toccarlo senza richiesta esplicita.
- Commit in italiano (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
- La CI (GitHub Actions) builda backend e frontend e pubblica le immagini su GHCR (`:test` da develop, `:prod` da main). Il job Cypress è **disattivato per scelta** (`if: ${{ false }}`): non riattivarlo.
- Per attendere la CI: `gh pr checks N --watch --interval 30` in primo piano. Mai cicli `until ! pgrep -f "…"`: trovano sé stessi e non finiscono.

## Board e issue
- GitHub Project "Wanderbite" (n. 2, owner Raukros00). Colonne: Backlog → In progress → In review → **Testing** → Done. Campi Priorità (P0–P2) e Dimensione (XS–XL).
- Flusso per ogni issue: In progress (assegnata) → MR → In review → CI verde → merge su develop → **Testing** con un commento "## Come testare" (passi per test.alessandrodominici.dev, telefono e desktop, risultato atteso, link alla MR). **Done lo sposta il proprietario** dopo averla provata; le issue si chiudono con il merge su main.
- Etichette per area: `gruppi`, `dettaglio viaggio`, `in viaggio`, `profilo`, `notifiche`, `autenticazione`, `sicurezza`, `test`, `deploy`, `epic`. Le epiche hanno le issue collegate come sub-issue.

## Ambienti (Raspberry Pi, accesso SSH fornito dal proprietario)
- Il repository è **pubblico**: niente IP, utenti, chiavi o segreti nei file versionati.
- Stack in `~/stacks/{test,prod,watchtower}`. Watchtower aggiorna le immagini ma **non** rilegge `.env` né `docker-compose.yml`: dopo modifiche servono `docker compose pull && docker compose up -d`.
- Prima di modificare `.env` o compose: backup (`*.bak-<data>`). Mai stampare segreti in output.
- **Produzione**: azioni distruttive o modifiche (DB, `.env`, compose) solo con conferma esplicita del proprietario e backup del DB prima. Checklist del prossimo rilascio: issue #143.

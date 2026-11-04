# Technical debt – Frontend

Stato dopo la migrazione ad Angular 21 (zoneless) del 2026-10-09.
Priorità: 🔴 alta · 🟡 media · 🟢 bassa.

## 1. Verifica post-migrazione 🔴

La migrazione è stata fatta senza aprire l'app nel browser e senza eseguire i test.

- [ ] Smoke test manuale dei flussi principali con zoneless attivo (un valore che non è un signal non aggiorna più la vista):
  - login / registrazione
  - creazione e modifica gruppo (l'icona ora è un signal, non più un campo del form)
  - inviti, condivisione, lista membri
  - creazione viaggio (`trip-create` ha ancora una `subscribe` su `valueChanges`)
  - dettaglio viaggio: tab food/attività/logistica e tutte le modali (attività, locale, assegna giorno, voli, transfer, alloggio)
- [ ] Confronto visivo prima/dopo: il CSS è stato spostato in `src/styles/` e nei nuovi componenti figli (dettaglio gruppo, dettaglio viaggio)
- [ ] Eseguire `ng test`: esiste solo `app.component.spec.ts`; Karma non è mai stato lanciato dopo il passaggio a `@angular/build:karma` (niente `zone.js/testing`)
- [ ] Scrivere test per i nuovi componenti e per `trip-detail.utils.ts`

## 2. Dipendenze

| Pacchetto | Attuale | Ultima | Note |
|---|---|---|---|
| Angular (`@angular/*`) | 21.2 | 22.2 | La 22 richiede Node ≥ 22.22 / 24.15; qui Node 20.20. Aggiornare anche `node:20-alpine` nel `Dockerfile` |
| `tailwindcss` | 3.4.19 | 4.3 | Major con migrazione (config CSS-first, plugin PostCSS) 🟡 |
| `typescript` | 5.9.3 | 7.0 | Angular 21 supporta fino a 5.9: attendere il supporto del framework |
| `jasmine-core` / `@types/jasmine` | 5.1 / 5.1 | 7.0 | Da aggiornare insieme a `karma-jasmine` |
| `karma-jasmine-html-reporter` | 2.1.0 | 2.3.0 | Minor |

- [ ] 🔴 `npm audit`: 11 vulnerabilità (9 high, 2 moderate), tra cui `postcss-selector-parser < 7.1.6`. Analizzarle una per una; non usare `npm audit fix --force` alla cieca
- [ ] 🟢 Valutare di sostituire Karma/Jasmine con Vitest (Karma è deprecato)
- [x] Rimossi `zone.js`, `@angular/animations`, `@angular/platform-browser-dynamic`, `lucide-angular`, `@lucide/angular` (non usati)

## 3. Zoneless e signal – completamento

- [ ] 🟡 `ChangeDetectionStrategy.OnPush` mancante su 13 componenti: `app`, `login`, `register`, `dashboard`, `profile`, `trip-list`, `trip-create`, `navbar`, `toast`, `palette-switcher`, `empty-state`, `modal`, `interactive-map`
- [ ] 🟢 Rimuovere `standalone: true` (default da Angular 19), ancora presente in 27 file
- [ ] 🟡 `[(ngModel)]` ancora in 6 template (`trip-assign-modal`, `trip-activities-tab`, `trip-food-tab`, `group-list`, `trip-list`, `trip-create`): sostituire con `[ngModel]` + `(ngModelChange)`, oppure con form reattivi / signal forms
- [ ] 🟡 Servizi (`auth`, `trip`, `group`, `storage`): `constructor()` e molte `.subscribe()` manuali. Valutare `httpResource` / `rxResource` / `toSignal` e gestione errori e loading centralizzata
- [ ] 🟢 `trip-create`: `valueChanges.subscribe` nel costruttore, portare a `toSignal` / `effect` con `takeUntilDestroyed`
- [ ] 🟢 `tsconfig.json`: `useDefineForClassFields: false` ed `experimentalDecorators: true` sono residui; riallineare ai default di Angular 21 e verificare la build
- [ ] 🟢 Router: usare `withComponentInputBinding()` per leggere i parametri di rotta come `input()` invece di `ActivatedRoute`

## 4. Struttura dei componenti

- [ ] 🟡 `group-form` non è usato da nessuna rotta e non è stato spezzato: eliminarlo o collegarlo
- [ ] 🟡 `group-create-modal` e `group-form` si sovrappongono (stesso form gruppo): unificare
- [ ] 🟢 `trip-detail.component.ts` è ancora l'orchestratore di tutto lo stato (~300 righe): valutare uno store/servizio dedicato per il viaggio selezionato
- [ ] 🟢 `generateFallbackCoords` in `trip-detail.utils.ts`: coordinate generate in modo fittizio, sostituire con geocoding reale

## 5. CSS comune

Creati in `src/styles/`: `_auth`, `_invite`, `_icon-picker`, `_members`, `_trip-shared`. Restano duplicati da unificare, dove lo stesso nome ha definizioni diverse (serve decidere quale design tenere):

- [ ] `.back-link` (3 pagine gruppi identiche, ma `trip-detail` e `trip-create` hanno varianti)
- [ ] `.link-btn` (`trip-itinerary` ha una variante diversa)
- [ ] `.section-title`, `.section-header`, `.section-icon`, `.section-card`, `.trip-counter`
- [ ] `.page-title`, `.page-desc`
- [ ] `.brand-highlight` (navbar vs auth)
- [ ] `.mt-3`: collide con l'utility Tailwind, usare solo quella
- [ ] Classi con lo stesso nome ma design diverso (`.trip-card`, `.trip-status*`, `.img-thumb`, `.search-input`, `.dropdown-item`, `.emoji-grid`, ...): rinominare o scoparle in modo esplicito
- [ ] Pattern flex/container ripetuti senza classe in comune: introdurre utility (o usare Tailwind in modo consistente)
- [ ] `tab-common.css` e `item-feed.css` in `trip-detail/components/shared/` sono referenziati via `styleUrls`: valutare lo spostamento in `src/styles/`
- [ ] Design token: molti colori e dimensioni sono ancora hard-coded (es. i colori del grafico budget)

## 6. Funzionalità incomplete

- [ ] 🟡 Spese: le spese del viaggio (`Trip.expenses`, tab "Spese") sono salvate **solo lato client** (signal + localStorage), perché il backend non le supporta e `updateTrip()` sostituisce il viaggio con la risposta del backend. Servono entità + endpoint backend per le spese (CRUD `/api/v1/trips/{id}/expenses`, con `shares`, `paidBy`, `type` expense/settlement), poi collegare `addExpense/updateExpense/deleteExpense` in `TripService`
- [ ] 🟢 Accessibilità: aggiungere un'alternativa testuale al grafico a ciambella (oggi c'è solo `aria-label` e la legenda)
- [ ] 🟡 Esplora: il catalogo di itinerari (`core/data/explore-catalog.ts`, `ExploreService`) è mock/locale, e `TripService.createTripFromTemplate` salva il viaggio solo in locale (nessuna sync backend di attività/locali). Servono endpoint template (lista/filtri/dettaglio, assegnazione a un gruppo che crea il viaggio con attività e locali), il flusso "pubblica il tuo viaggio" e la persistenza di `usesCount`, `rating` e recensioni

## 7. Git e processo

- [ ] 🔴 Nessuna modifica è committata (~60 file). Dividere in commit separati: dipendenze, zoneless, split dei componenti, CSS, budget
- [ ] 🟢 Eliminare lo stash obsoleto `budget card + ng19 migration` (`git stash drop`)
- [ ] 🟢 Aggiungere un CI minimo: `ng build`, `ng test`, `npm audit`

#!/usr/bin/env bash
# Avvia l'ambiente e2e e apre Cypress con l'interfaccia grafica (macOS).
#
#   ./scripts/e2e-ui.sh              stack + app + Cypress; alla chiusura spegne tutto
#   ./scripts/e2e-ui.sh --keep       alla chiusura lascia acceso lo stack Docker (riavvio più veloce)
#   ./scripts/e2e-ui.sh --fresh      riparte da un database pulito (solo dati demo)
#   ./scripts/e2e-ui.sh --browser chrome    usa quel browser (chrome, electron, firefox, edge)
#   ./scripts/e2e-ui.sh --run        niente interfaccia: esegue tutta la suite headless
#
# Con --run la suite usa Chrome se è installato (altrimenti Electron) e ha un tempo massimo:
# se lo supera chiude Cypress, spegne lo stack ed esce con errore invece di restare appesa.
#
# Variabili d'ambiente:
#   E2E_TIMEOUT_MIN=15       minuti massimi per la suite con --run (0 = nessun limite)
#   E2E_APP_TIMEOUT_S=300    secondi massimi per l'avvio dell'app Angular
#
# Cosa fa: avvia Docker Desktop se serve, installa le dipendenze se mancano, avvia backend +
# Postgres + finti Unsplash/GeoNames (docker-compose.e2e.yml), l'app Angular su
# http://127.0.0.1:4300 e infine Cypress. Ctrl+C o la chiusura di Cypress fermano tutto.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
COMPOSE=(docker compose -f "$ROOT/docker-compose.e2e.yml")
APP_PORT=4300
APP_URL="http://127.0.0.1:$APP_PORT"
BACKEND_HEALTH="http://127.0.0.1:18083/actuator/health"
LOG="${TMPDIR:-/tmp}"; LOG="${LOG%/}/wanderbite-e2e-serve.log"
RUN_TIMEOUT_MIN="${E2E_TIMEOUT_MIN:-15}"
APP_TIMEOUT_S="${E2E_APP_TIMEOUT_S:-300}"

KEEP=false
FRESH=false
HEADLESS=false
BROWSER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP=true ;;
    --fresh) FRESH=true ;;
    --run) HEADLESS=true ;;
    --browser) BROWSER="${2:?--browser richiede un nome (es. chrome)}"; shift ;;
    -h|--help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "Opzione sconosciuta: $1 (vedi --help)" >&2; exit 2 ;;
  esac
  shift
done
[[ "$RUN_TIMEOUT_MIN" =~ ^[0-9]+$ ]] || { echo "E2E_TIMEOUT_MIN deve essere un numero di minuti" >&2; exit 2; }
[[ "$APP_TIMEOUT_S" =~ ^[0-9]+$ ]] || { echo "E2E_APP_TIMEOUT_S deve essere un numero di secondi" >&2; exit 2; }

# Node e npm di Homebrew prima di eventuali versioni più vecchie nel PATH (Angular richiede Node ≥ 20.19).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export NG_CLI_ANALYTICS=false

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# Richiesta con timeout: un server che accetta la connessione ma non risponde non deve bloccare lo script.
responds() { curl -sf -o /dev/null --connect-timeout 3 --max-time 10 "$1"; }

wait_for() { # url, secondi, descrizione
  local url="$1" timeout="$2" what="$3" start=$SECONDS
  until responds "$url"; do
    (( SECONDS - start > timeout )) && fail "$what non risponde dopo ${timeout}s"
    sleep 2
  done
}

# Termina un gruppo di processi: prima con garbo, poi forzando chi resta.
kill_group() { # pid del capogruppo
  local pid="$1"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || return 0
  for _ in 1 2 3 4 5; do
    kill -0 -- "-$pid" 2>/dev/null || return 0
    sleep 1
  done
  kill -KILL -- "-$pid" 2>/dev/null || true
}

SERVE_PID=""
STARTED_SERVE=false
CYPRESS_PID=""
WATCHDOG_PID=""
TIMEOUT_FLAG=""
cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if [[ -n "$WATCHDOG_PID" ]]; then kill_group "$WATCHDOG_PID"; fi
  if [[ -n "$CYPRESS_PID" ]]; then
    step "Chiudo Cypress"
    kill_group "$CYPRESS_PID"
  fi
  if [[ -n "$TIMEOUT_FLAG" ]]; then rm -f "$TIMEOUT_FLAG"; fi
  if $STARTED_SERVE && [[ -n "$SERVE_PID" ]]; then
    step "Spengo l'app Angular"
    # ng serve avvia dei processi figli: chiudo l'intero gruppo.
    kill_group "$SERVE_PID"
  fi
  if $KEEP; then
    ok "Stack Docker lasciato acceso (spegnilo con: cd frontend && npm run e2e:stack:down)"
  else
    step "Spengo lo stack Docker"
    "${COMPOSE[@]}" down >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM

# 1. Strumenti
command -v node >/dev/null || fail "Node.js non trovato: installalo con 'brew install node'"
command -v docker >/dev/null || fail "Docker non trovato: installa Docker Desktop"

# 2. Docker Desktop
if ! docker info >/dev/null 2>&1; then
  step "Avvio Docker Desktop"
  open -a Docker || fail "Impossibile aprire Docker Desktop"
  start=$SECONDS
  until docker info >/dev/null 2>&1; do
    (( SECONDS - start > 120 )) && fail "Docker non è partito entro 2 minuti"
    sleep 3
  done
fi
ok "Docker attivo"

# 3. Dipendenze del frontend (comprese Cypress e il suo binario)
cd "$FRONTEND"
if [[ ! -d node_modules ]]; then
  step "Installo le dipendenze del frontend (npm ci)"
  npm ci
fi
npx cypress verify >/dev/null 2>&1 || { step "Installo il binario di Cypress"; npx cypress install; }
ok "Dipendenze pronte"

# 4. Stack e2e: backend + Postgres + finti servizi esterni
if $FRESH; then
  step "Riparto da un database pulito"
  "${COMPOSE[@]}" down >/dev/null 2>&1 || true
fi
step "Avvio backend, Postgres e servizi finti (può richiedere qualche minuto la prima volta)"
"${COMPOSE[@]}" up -d --build --wait
wait_for "$BACKEND_HEALTH" 120 "Il backend"
ok "Backend pronto su http://127.0.0.1:18083"

# 5. App Angular (se è già in esecuzione sulla 4300 la riuso)
port_owner() { lsof -nP -iTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR > 1 { print $1 " (pid " $2 ")"; exit }' || true; }
if responds "$APP_URL"; then
  ok "App Angular già in esecuzione su $APP_URL"
else
  owner="$(port_owner)"
  # Porta occupata da un processo che non risponde (es. un ng serve rimasto appeso): ng serve non partirebbe.
  [[ -n "$owner" ]] && fail "La porta $APP_PORT è occupata da $owner ma $APP_URL non risponde: chiudi quel processo e rilancia."
  step "Avvio l'app Angular (log: $LOG)"
  # set -m: processo in un gruppo proprio, così in uscita si chiude anche ciò che avvia.
  set -m
  npm run e2e:serve >"$LOG" 2>&1 &
  SERVE_PID=$!
  set +m
  STARTED_SERVE=true
  start=$SECONDS
  until responds "$APP_URL"; do
    if ! kill -0 "$SERVE_PID" 2>/dev/null; then
      tail -n 20 "$LOG" >&2 || true
      fail "L'app Angular si è chiusa durante l'avvio: vedi il log completo in $LOG"
    fi
    if (( SECONDS - start > APP_TIMEOUT_S )); then
      tail -n 20 "$LOG" >&2 || true
      fail "L'app Angular non risponde su $APP_URL dopo ${APP_TIMEOUT_S}s (compilazione bloccata o troppo lenta). Log completo: $LOG. Per alzare il limite: E2E_APP_TIMEOUT_S."
    fi
    sleep 2
  done
  ok "App pronta su $APP_URL in $(( SECONDS - start ))s"
fi

# 6. Cypress
if $HEADLESS; then
  if [[ -z "$BROWSER" ]]; then
    # Chrome regge meglio di Electron le run lunghe; se manca resta Electron (incluso in Cypress).
    if npx cypress info 2>/dev/null | grep -q -- '- Name: chrome'; then BROWSER=chrome; else BROWSER=electron; fi
  fi
  limit="nessun limite di tempo"
  (( RUN_TIMEOUT_MIN > 0 )) && limit="limite ${RUN_TIMEOUT_MIN} min"
  step "Eseguo tutta la suite Cypress (headless, $BROWSER, $limit)"
  # Cypress in un gruppo di processi proprio, così il watchdog (e Ctrl+C) lo chiudono con tutto il browser.
  set -m
  npx cypress run --e2e --browser "$BROWSER" &
  CYPRESS_PID=$!
  if (( RUN_TIMEOUT_MIN > 0 )); then
    TIMEOUT_FLAG="${TMPDIR:-/tmp}"; TIMEOUT_FLAG="${TIMEOUT_FLAG%/}/wanderbite-e2e-timeout.$$"
    rm -f "$TIMEOUT_FLAG"
    # Watchdog (macOS non ha `timeout`): allo scadere segna il timeout e chiude il gruppo di Cypress.
    (
      sleep $(( RUN_TIMEOUT_MIN * 60 ))
      : >"$TIMEOUT_FLAG"
      kill -TERM -- "-$CYPRESS_PID" 2>/dev/null
      sleep 10
      kill -KILL -- "-$CYPRESS_PID" 2>/dev/null
    ) &
    WATCHDOG_PID=$!
    # Niente messaggio "Terminated" di bash quando il watchdog viene fermato a fine run.
    disown "$WATCHDOG_PID"
  fi
  set +m
  code=0
  wait "$CYPRESS_PID" || code=$?
  CYPRESS_PID=""
  # Il watchdog va sempre fermato, anche quando la suite finisce in tempo.
  if [[ -n "$WATCHDOG_PID" ]]; then
    kill_group "$WATCHDOG_PID"
    WATCHDOG_PID=""
  fi
  if [[ -n "$TIMEOUT_FLAG" && -e "$TIMEOUT_FLAG" ]]; then
    fail "La suite Cypress ha superato il limite di ${RUN_TIMEOUT_MIN} minuti ed è stata interrotta (probabile blocco del browser). Rilancia; per cambiare il limite usa E2E_TIMEOUT_MIN."
  fi
  exit "$code"
else
  step "Apro Cypress: scegli uno spec dalla finestra. Chiudi Cypress (o Ctrl+C qui) per spegnere tutto."
  args=(open --e2e)
  [[ -n "$BROWSER" ]] && args+=(--browser "$BROWSER")
  npx cypress "${args[@]}"
fi

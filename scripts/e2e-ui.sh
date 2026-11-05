#!/usr/bin/env bash
# Avvia l'ambiente e2e e apre Cypress con l'interfaccia grafica (macOS).
#
#   ./scripts/e2e-ui.sh              stack + app + Cypress; alla chiusura spegne tutto
#   ./scripts/e2e-ui.sh --keep       alla chiusura lascia acceso lo stack Docker (riavvio più veloce)
#   ./scripts/e2e-ui.sh --fresh      riparte da un database pulito (solo dati demo)
#   ./scripts/e2e-ui.sh --browser chrome    apre direttamente quel browser (chrome, electron, firefox, edge)
#   ./scripts/e2e-ui.sh --run        niente interfaccia: esegue tutta la suite headless
#
# Cosa fa: avvia Docker Desktop se serve, installa le dipendenze se mancano, avvia backend +
# Postgres + finti Unsplash/GeoNames (docker-compose.e2e.yml), l'app Angular su
# http://127.0.0.1:4300 e infine Cypress. Ctrl+C o la chiusura di Cypress fermano tutto.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
COMPOSE=(docker compose -f "$ROOT/docker-compose.e2e.yml")
APP_URL="http://127.0.0.1:4300"
BACKEND_HEALTH="http://127.0.0.1:18083/actuator/health"
LOG="${TMPDIR:-/tmp}"; LOG="${LOG%/}/wanderbite-e2e-serve.log"

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
    -h|--help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opzione sconosciuta: $1 (vedi --help)" >&2; exit 2 ;;
  esac
  shift
done

# Node e npm di Homebrew prima di eventuali versioni più vecchie nel PATH (Angular richiede Node ≥ 20.19).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export NG_CLI_ANALYTICS=false

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

wait_for() { # url, secondi, descrizione
  local url="$1" timeout="$2" what="$3" start=$SECONDS
  until curl -sf -o /dev/null "$url"; do
    (( SECONDS - start > timeout )) && fail "$what non risponde dopo ${timeout}s"
    sleep 2
  done
}

SERVE_PID=""
STARTED_SERVE=false
cleanup() {
  local code=$?
  trap - EXIT INT TERM
  if $STARTED_SERVE && [[ -n "$SERVE_PID" ]]; then
    step "Spengo l'app Angular"
    # ng serve avvia dei processi figli: chiudo l'intero gruppo.
    kill -- "-$SERVE_PID" 2>/dev/null || kill "$SERVE_PID" 2>/dev/null || true
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
if curl -sf -o /dev/null "$APP_URL"; then
  ok "App Angular già in esecuzione su $APP_URL"
else
  step "Avvio l'app Angular (log: $LOG)"
  # set -m: processo in un gruppo proprio, così in uscita si chiude anche ciò che avvia.
  set -m
  npm run e2e:serve >"$LOG" 2>&1 &
  SERVE_PID=$!
  set +m
  STARTED_SERVE=true
  wait_for "$APP_URL" 240 "L'app Angular (vedi $LOG)"
  ok "App pronta su $APP_URL"
fi

# 6. Cypress
if $HEADLESS; then
  step "Eseguo tutta la suite Cypress (headless)"
  npx cypress run --e2e
else
  step "Apro Cypress: scegli uno spec dalla finestra. Chiudi Cypress (o Ctrl+C qui) per spegnere tutto."
  args=(open --e2e)
  [[ -n "$BROWSER" ]] && args+=(--browser "$BROWSER")
  npx cypress "${args[@]}"
fi

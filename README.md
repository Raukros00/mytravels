# WanderBite / MyTravels - Infrastructure & Environments

Questo repository contiene il frontend (Angular PWA), il backend (Spring Boot) e le configurazioni Docker / CI-CD per la gestione dei due ambienti **TEST** e **PROD**.

---

## Panoramica Ambienti e Porte

| Ambiente | Dominio | Frontend (Host Port) | Backend (Host Port) | PostgreSQL (solo localhost) | Compose File | Compose Project |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST** | `test.alessandrodominici.dev` | `8091` $\rightarrow$ `80` | `8093` $\rightarrow$ `8080` | `127.0.0.1:5443` $\rightarrow$ `5432` | `docker-compose.test.yml` | `mytravels-test` |
| **PROD** | `wanderbite.alessandrodominici.dev` | `8081` $\rightarrow$ `80` | `8083` $\rightarrow$ `8080` | `127.0.0.1:5433` $\rightarrow$ `5432` | `docker-compose.prod.yml` | `wanderbite-prod` |

Variabili obbligatorie nel `.env` di ogni ambiente (vedi `.env.example`): `POSTGRES_PASSWORD`, `JWT_SECRET` (diverso per ambiente, `openssl rand -hex 32`).
Il backend espone `GET /actuator/health`, usato dall'healthcheck Docker. Postgres è escluso dagli aggiornamenti automatici di Watchtower.

### Notifiche push (facoltative)

Le notifiche push (Web Push, standard dei browser: nessun servizio a pagamento) richiedono una coppia di chiavi **VAPID**
per ambiente, generata **una sola volta** (cambiandola, i dispositivi già abbonati smettono di ricevere le notifiche):

```bash
npx web-push generate-vapid-keys
```

e tre variabili nel `.env` dell'ambiente (vedi `.env.example`):

| Variabile | Valore |
| :--- | :--- |
| `PUSH_VAPID_PUBLIC_KEY` | "Public Key" stampata dal comando (base64url) |
| `PUSH_VAPID_PRIVATE_KEY` | "Private Key" stampata dal comando (base64url, segreta) |
| `PUSH_VAPID_SUBJECT` | contatto per i push service: `mailto:indirizzo@dominio` oppure `https://dominio-del-sito` |

Se ne manca anche una sola le push sono disattivate e l'app funziona come prima. Dopo averle aggiunte serve
`docker compose pull && docker compose up -d` (Watchtower aggiorna le immagini ma non rilegge il `.env`).
Le chiavi in `docker-compose.e2e.yml` sono solo per i test end-to-end (push service finto in `e2e/api-stubs.py`).

Per collegarsi al database da un altro PC usare un tunnel SSH, es. `ssh -L 5433:localhost:5433 alessandrodominici@192.168.0.36`.

Entrambi gli ambienti hanno nomi di container, network e volumi Docker distinti, permettendo l'esecuzione simultanea sullo stesso server senza conflitti.

---

## Sviluppo Locale (Frontend)

Quando sviluppi localmente sul frontend:
```bash
cd frontend
npm install
npm start
```
Il frontend si avvierà su `http://localhost:4200` e il proxy interno (`frontend/proxy.conf.json`) inoltrerà automaticamente tutte le chiamate `/api/*` e `/auth/*` al backend di **TEST** (`https://test.alessandrodominici.dev`).

---

## Gestione con Docker Compose

### 1. Avviare l'Ambiente di TEST
```bash
# Con il file compose dedicato di test:
docker compose -f docker-compose.test.yml up -d

# Oppure usando le variabili d'ambiente di test:
docker compose --env-file .env.test up -d
```

### 2. Avviare l'Ambiente di PROD
```bash
# Con il file compose dedicato di prod:
docker compose -f docker-compose.prod.yml up -d

# Oppure usando le variabili d'ambiente di prod:
docker compose --env-file .env.prod up -d
```

### 3. Stop e visualizzazione log
```bash
# Test:
docker compose -f docker-compose.test.yml logs -f
docker compose -f docker-compose.test.yml down

# Prod:
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down
```

---

## Pipeline CI/CD (GitHub Actions)

La pipeline `.github/workflows/ci-cd.yml` viene eseguita automaticamente ad ogni push/PR su `main`/`master` o tramite trigger manuale (`workflow_dispatch`).

Immagini pubblicate su GitHub Container Registry (`ghcr.io`):
- **Backend**: `ghcr.io/raukros00/mytravels-backend` con tag `:test`, `:prod`, `:latest`, `:<commit_sha>`
- **Frontend**: `ghcr.io/raukros00/mytravels-frontend` con tag `:test`, `:prod`, `:latest`, `:<commit_sha>`

---

## Configurazione Reverse Proxy Host (Esempio Nginx su Server)

Se utilizzi Nginx come reverse proxy sul server host:

### Configurazione TEST (`test.alessandrodominici.dev`)
```nginx
server {
    server_name test.alessandrodominici.dev;

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Configurazione PROD (`wanderbite.alessandrodominici.dev`)
```nginx
server {
    server_name wanderbite.alessandrodominici.dev;

    location / {
        proxy_pass http://127.0.0.1:8091;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

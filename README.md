# WanderBite / MyTravels - Infrastructure & Environments

Questo repository contiene il frontend (Angular PWA), il backend (Spring Boot) e le configurazioni Docker / CI-CD per la gestione dei due ambienti **TEST** e **PROD**.

---

## Panoramica Ambienti e Porte

| Ambiente | Dominio | Frontend (Host Port) | Backend (Host Port) | MongoDB (Host Port) | Compose File | Compose Project |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST** | `test.alessandrodominici.dev` | `8081` $\rightarrow$ `80` | `8083` $\rightarrow$ `8080` | `27017` $\rightarrow$ `27017` | `docker-compose.test.yml` | `mytravels-test` |
| **PROD** | `wanderbite.alessandrodominici.dev` | `8091` $\rightarrow$ `80` | `8093` $\rightarrow$ `8080` | `27018` $\rightarrow$ `27017` | `docker-compose.prod.yml` | `wanderbite-prod` |

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

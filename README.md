# IncidentTraining — Deployment & Operations Guide

A full-stack **incident response training application** for simulating outages, practising triage and communication, and capturing learning outcomes.

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite 6 + TypeScript |
| **Backend** | Node.js 22 (ESM) — plain `http` module, no Express |
| **Database** | MySQL 8 (Azure Database for MySQL Flexible Server or local) |
| **Auth** | Password-based login (plaintext compare; bcrypt is imported but currently not used) |

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Layout](#repository-layout)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Azure / Cloud Deployment](#azure--cloud-deployment)
   - [Prerequisites](#prerequisites-azure)
   - [Azure Database for MySQL](#1-azure-database-for-mysql-flexible-server)
   - [Backend — Azure App Service](#2-backend--azure-app-service)
   - [Frontend — Azure Static Web Apps](#3-frontend--azure-static-web-apps)
   - [GitHub Actions CI/CD](#4-github-actions-cicd)
   - [Environment Variables (Azure)](#5-environment-variables-azure)
   - [Firewall & CORS](#6-firewall--cors)
   - [Post-Deployment Checklist](#7-post-deployment-checklist)
6. [Local / LAN / WiFi Setup](#local--lan--wifi-setup)
   - [Prerequisites](#prerequisites-local)
   - [MySQL Setup](#1-mysql-setup-local)
   - [Backend Setup](#2-backend-setup)
   - [Frontend Setup](#3-frontend-setup)
   - [LAN / WiFi Access](#4-lan--wifi-access)
   - [Running Both Services Together](#5-running-both-services-together)
7. [Seed Data](#seed-data)
8. [Troubleshooting](#troubleshooting)
9. [Security Notes](#security-notes)

---

## Architecture Overview

```
┌──────────────────────────┐       ┌──────────────────────────────────┐
│   Browser / Client       │◄─────►│   Frontend (React + Vite)        │
│                          │ HTTP  │   Dev  : http://localhost:3000   │
│                          │       │   Prod : Azure Static Web Apps   │
└──────────────────────────┘       └──────────────────────────────────┘
                                                   │
                                                   │  /api/* proxy
                                                   ▼
                                   ┌──────────────────────────────────┐
                                   │   Backend (Node.js HTTP server)  │
                                   │   Dev  : http://localhost:3001   │
                                   │   Prod : Azure App Service       │
                                   └──────────────────────────────────┘
                                                   │
                                                   │  mysql2/promise + SSL
                                                   ▼
                                   ┌──────────────────────────────────┐
                                   │   MySQL 8 Database               │
                                   │   Dev  : localhost:3306          │
                                   │   Prod : Azure DB for MySQL      │
                                   └──────────────────────────────────┘
```

The frontend Vite dev server proxies all `/api/*` requests to the backend on port **3001** (configured in `frontend/vite.config.ts`). In production, the frontend `.env.production` points `VITE_API_URL` directly at the Azure App Service URL.

---

## Repository Layout

```
incident-training/
├── .github/
│   └── workflows/
│       ├── azure-static-web-apps-lively-bay-0a8309b00.yml   # Frontend CI/CD → Azure Static Web Apps
│       └── initial-draft_incident-training.yml              # Backend CI/CD → Azure App Service
├── frontend/
│   ├── src/
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Root component & routing
│   │   ├── api.ts             # Axios base URL + all API calls
│   │   └── index.css          # Global styles
│   ├── .env.development       # VITE_API_URL=http://localhost:3001
│   ├── .env.production        # VITE_API_URL=https://<azure-app-service>.azurewebsites.net
│   ├── vite.config.ts         # Vite build config (port 3000, proxy /api → 3001)
│   └── package.json
├── backend/
│   ├── server.js              # HTTP server, all route handlers
│   ├── db.js                  # mysql2/promise pool + all DB helpers
│   ├── .env                   # DB credentials & APP_PORT (NOT committed to Git)
│   └── package.json
├── incident-mysql-query.txt   # Full DDL for all database tables
├── insert_userTbl.txt         # Seed data: users
├── insert_scenarioTbl.txt     # Seed data: scenarios (Practice)
├── insert_exam_secnarioTbl.txt # Seed data: scenarios (Exam)
├── insert_questions.txt       # Seed data: practice questions
├── insert_exam_question.txt   # Seed data: exam questions
├── insert_performanceCriteria.txt # Seed data: performance criteria
└── README.md                  # This file
```

---

## Database Schema

All DDL is in [`incident-mysql-query.txt`](./incident-mysql-query.txt). The database name is **`incidenttrainingdb`**.

| Table | Purpose |
|-------|---------|
| `UserTbl` | Application users (Students, Faculty, Admin) |
| `ScenarioTbl` | Incident scenarios (type: `Exam` or `Practice`) |
| `PerformanceCriteria` | PC codes & titles for question categorisation |
| `QuestionsTbl` | Questions with options, correct answers, hints (JSON columns) |
| `ResultsTbl` | Student practice/exam submissions & grades |
| `FormGTbl` | Incident Notification Form G submissions |
| `FormG1Tbl` | Incident Investigation Form G1 submissions |

---

## API Reference

All endpoints served by the Node.js backend. Base path: `/api`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Authenticate user by `OrgUserId` or `UserEmail` |
| `GET` | `/api/scenarios` | List all **Exam** scenarios |
| `GET` | `/api/practice-scenarios` | List all **Practice** scenarios |
| `GET` | `/api/performance-criteria` | List all PC codes |
| `GET` | `/api/questions?scenarioId=&pc=` | Questions for a scenario/PC combination |
| `POST` | `/api/practice/submit` | Submit & auto-grade practice/exam answers |
| `GET` | `/api/results?studentId=&limit=` | Recent results for a student |
| `GET` | `/api/users` | List all users (Faculty use) |
| `POST` | `/api/users/create` | Create a new user |
| `POST` | `/api/users/update` | Update user details |
| `POST` | `/api/users/deactivate` | Deactivate a user |
| `POST` | `/api/users/delete` | Delete user and all their data |
| `GET` | `/api/faculty/stats` | Aggregated dashboard stats for Faculty |
| `GET` | `/api/exam-results` | All exam submissions (Faculty grading view) |
| `POST` | `/api/exam-results/grade` | Save grade + faculty comments for a result |
| `POST` | `/api/formg` | Submit Form G (Incident Notification) |
| `GET` | `/api/formg?studentid=&modeofexam=&questionid=` | Retrieve saved Form G |
| `POST` | `/api/formg1` | Submit Form G1 (Incident Investigation) |
| `GET` | `/api/formg1?studentid=&modeofexam=&questionid=` | Retrieve saved Form G1 |

---

---

# Azure / Cloud Deployment

## Prerequisites (Azure)

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Azure CLI | 2.60+ | `az --version` |
| Node.js | 22.x | Required for building frontend |
| npm | 10+ | Bundled with Node.js 22 |
| Git | any | For pushing to GitHub |
| GitHub repository | — | CI/CD triggers on push to `initial-draft` branch |

> **Tip:** Install the Azure CLI on Windows with `winget install Microsoft.AzureCLI` or download from [https://aka.ms/installazurecliwindows](https://aka.ms/installazurecliwindows).

---

## 1. Azure Database for MySQL (Flexible Server)

The backend is already pre-configured to connect to Azure Database for MySQL with SSL (`rejectUnauthorized: false`).

### 1a. Create the server (if not already created)

```bash
az mysql flexible-server create \
  --resource-group <your-resource-group> \
  --name incident-training-db-dev \
  --location southindia \
  --admin-user adosh_dev \
  --admin-password "<strong-password>" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 8.0.21 \
  --public-access 0.0.0.0
```

### 1b. Create the database

```bash
az mysql flexible-server db create \
  --resource-group <your-resource-group> \
  --server-name incident-training-db-dev \
  --database-name incidenttrainingdb
```

### 1c. Allow Azure services access

```bash
az mysql flexible-server firewall-rule create \
  --resource-group <your-resource-group> \
  --name incident-training-db-dev \
  --rule-name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 1d. Run the schema (DDL)

Connect to your Azure MySQL instance (via Azure Cloud Shell, MySQL Workbench, or MySQL CLI):

```bash
mysql -h incident-training-db-dev.mysql.database.azure.com \
      -u adosh_dev \
      -p \
      --ssl-mode=REQUIRED \
      incidenttrainingdb < incident-mysql-query.txt
```

### 1e. Load seed data

```bash
# Performance Criteria
mysql -h incident-training-db-dev.mysql.database.azure.com \
      -u adosh_dev -p --ssl-mode=REQUIRED \
      incidenttrainingdb < insert_performanceCriteria.txt

# Scenarios
mysql ... incidenttrainingdb < insert_scenarioTbl.txt
mysql ... incidenttrainingdb < insert_exam_secnarioTbl.txt

# Questions
mysql ... incidenttrainingdb < insert_questions.txt
mysql ... incidenttrainingdb < insert_exam_question.txt

# Users (includes default admin/faculty/student accounts)
mysql ... incidenttrainingdb < insert_userTbl.txt
```

---

## 2. Backend — Azure App Service

The backend is deployed as a **Node.js 22 Web App** on Azure App Service. The GitHub Actions workflow (`.github/workflows/initial-draft_incident-training.yml`) handles CI/CD automatically on every push to the `initial-draft` branch.

### 2a. Create the App Service (if not already created)

```bash
# Create App Service Plan
az appservice plan create \
  --name incident-training-plan \
  --resource-group <your-resource-group> \
  --sku B1 \
  --is-linux

# Create the Web App
az webapp create \
  --name incident-training \
  --resource-group <your-resource-group> \
  --plan incident-training-plan \
  --runtime "NODE:22-lts"
```

### 2b. Set environment variables on App Service

```bash
az webapp config appsettings set \
  --name incident-training \
  --resource-group <your-resource-group> \
  --settings \
    DB_HOST="incident-training-db-dev.mysql.database.azure.com" \
    DB_USER="adosh_dev" \
    DB_PASS="<your-db-password>" \
    DB_NAME="incidenttrainingdb" \
    APP_PORT="3001" \
    NODE_ENV="production" \
    WEBSITE_NODE_DEFAULT_VERSION="22.x"
```

> **Important:** The `PORT` environment variable on Azure App Service is automatically set by the platform to the port where the web server must listen. The backend (`server.js`) reads `process.env.PORT || process.env.APP_PORT || 3001`. Azure will override `PORT` automatically — no action needed.

### 2c. Set the startup command

```bash
az webapp config set \
  --name incident-training \
  --resource-group <your-resource-group> \
  --startup-file "node server.js"
```

### 2d. Configure GitHub Actions secrets for backend CI/CD

In your GitHub repository → **Settings → Secrets and variables → Actions**, add:

| Secret Name | Value |
|-------------|-------|
| `AZUREAPPSERVICE_CLIENTID_DE93C4D5020C4F248EA7F277BBE8BB19` | Azure Service Principal Client ID |
| `AZUREAPPSERVICE_TENANTID_76DA172D1D3A405C8E9A5B16D3C5DE14` | Azure Tenant ID |
| `AZUREAPPSERVICE_SUBSCRIPTIONID_D60DD8CAF3FA44A0AABC2B5D9607C391` | Azure Subscription ID |

Generate a Service Principal if needed:

```bash
az ad sp create-for-rbac \
  --name "incident-training-sp" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<resource-group> \
  --sdk-auth
```

### 2e. Backend URL

After deployment, the backend API URL is assigned by Azure and will look like:

```
https://<app-name>-<random-id>.<region>-01.azurewebsites.net
```

> **How to find your URL:** Go to **Azure Portal → App Services → `incident-training` → Overview**.
> Copy the **Default domain** value shown there. Use this URL in the `VITE_API_URL` of `frontend/.env.production` (see §3a below) and in any CORS configuration.

---

## 3. Frontend — Azure Static Web Apps

The frontend is built by Vite and deployed as a static site on **Azure Static Web Apps**. The GitHub Actions workflow (`.github/workflows/azure-static-web-apps-lively-bay-0a8309b00.yml`) handles CI/CD.

### 3a. Production environment variable

Before building for production, update `frontend/.env.production` with the backend URL obtained from the Azure portal (see §2e):

```env
VITE_API_URL=https://<your-app-service-default-domain>
```

> **Where to get this value:** **Azure Portal → App Services → `incident-training` → Overview → Default domain**.  
> Copy the full URL and paste it as the value of `VITE_API_URL`, then commit the file before triggering a CI build.

This file **is** committed to Git and is used by the Vite build step in CI.

### 3b. Create the Static Web App (if not already created)

```bash
az staticwebapp create \
  --name incident-training-frontend \
  --resource-group <your-resource-group> \
  --location "southindia" \
  --sku Free \
  --source https://github.com/<your-org>/incident-training \
  --branch initial-draft \
  --app-location "./frontend" \
  --output-location "build"
```

> **Note:** When the Static Web App is created with the `--source` GitHub link (or via the Azure Portal wizard with GitHub connected), Azure **automatically** adds the deployment token as a GitHub Actions secret in your repository. You do **not** need to copy or add it manually.  
> The secret will appear as `AZURE_STATIC_WEB_APPS_API_TOKEN_LIVELY_BAY_0A8309B00` (the suffix matches your resource name) and is already referenced in the workflow file.  
> You only need to add it manually if you created the Static Web App without linking GitHub, or if you ever need to **regenerate** the token (via **Azure Portal → Static Web Apps → `incident-training-frontend` → Manage deployment token**).

### 3c. Manual build & deploy (without CI/CD)

```bash
cd frontend
npm install
npm run build          # Output goes to frontend/build/

# Deploy using Azure CLI
az staticwebapp deploy \
  --name incident-training-frontend \
  --resource-group <your-resource-group> \
  --source ./build
```

---

## 4. GitHub Actions CI/CD

### Backend pipeline (`.github/workflows/initial-draft_incident-training.yml`)

Triggered on: `push` to `initial-draft` branch or manual `workflow_dispatch`.

| Step | What it does |
|------|-------------|
| Checkout | Clones the repository |
| Setup Node.js 22.x | Installs Node.js |
| npm install | Installs backend dependencies from `./backend` |
| Upload artifact | Packages `./backend` folder |
| Login to Azure | Uses Service Principal secrets |
| Deploy to Azure Web App | Deploys to `incident-training` App Service (Production slot) |

### Frontend pipeline (`.github/workflows/azure-static-web-apps-lively-bay-0a8309b00.yml`)

Triggered on: `push` or `pull_request` to `initial-draft` branch.

| Step | What it does |
|------|-------------|
| Checkout | Clones the repository |
| Build And Deploy | Uses `Azure/static-web-apps-deploy@v1` action; app location `./frontend`, output `build/` |
| Close PR | Cleans up staging environment on PR close |

---

## 5. Environment Variables (Azure)

### Backend (App Service Application Settings)

| Variable | Example Value | Description |
|----------|--------------|-------------|
| `DB_HOST` | `incident-training-db-dev.mysql.database.azure.com` | Azure MySQL hostname |
| `DB_USER` | `adosh_dev` | MySQL username |
| `DB_PASS` | `*****` | MySQL password (store as secret) |
| `DB_NAME` | `incidenttrainingdb` | Database name |
| `APP_PORT` | `3001` | Fallback port (Azure overrides with `PORT`) |
| `NODE_ENV` | `production` | Node environment |

### Frontend (Vite Build-time)

| Variable | Example Value | Description |
|----------|--------------|-------------|
| `VITE_API_URL` | `https://<your-app-service-default-domain>` | Backend API base URL — copy from **Azure Portal → App Services → Overview → Default domain** (embedded at build time) |

> **Note:** Vite bakes `VITE_*` variables into the static bundle at build time. Changing them requires a rebuild and redeployment.

---

## 6. Firewall & CORS

### MySQL Firewall
- Allow **Azure Services** (`0.0.0.0 – 0.0.0.0`) so App Service can connect.
- If you need to connect from your developer machine, add your IP:
  ```bash
  az mysql flexible-server firewall-rule create \
    --resource-group <rg> \
    --name incident-training-db-dev \
    --rule-name AllowMyIP \
    --start-ip-address <your-ip> \
    --end-ip-address <your-ip>
  ```

### CORS (Backend)
The backend currently sets:
```
Access-Control-Allow-Origin: *
```
This is permissive and acceptable for development/training. For production, restrict to your Static Web App domain:
- Update `sendJSON()` in `backend/server.js` to set `Access-Control-Allow-Origin` to your Static Web App URL (e.g., `https://lively-bay-0a8309b00.azurestaticapps.net`).

---

## 7. Post-Deployment Checklist

- [ ] Azure MySQL Flexible Server is running and accessible from App Service
- [ ] All DDL tables created (`incident-mysql-query.txt` executed)
- [ ] Seed data loaded (scenarios, questions, performance criteria, users)
- [ ] Backend App Service environment variables set correctly
- [ ] Backend health check: `GET https://<app-service-url>/api/scenarios` returns JSON array
- [ ] Frontend `VITE_API_URL` in `.env.production` matches the App Service URL
- [ ] Frontend CI/CD workflow ran successfully and Static Web App is live
- [ ] Login works with a test account from `insert_userTbl.txt`
- [ ] CORS restricted to the Static Web App domain (for production hardening)

---

---

# Local / LAN / WiFi Setup

## Prerequisites (Local)

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 18+ (22 recommended) | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node.js |
| MySQL | 8.0+ | [dev.mysql.com/downloads](https://dev.mysql.com/downloads/mysql/) or Docker |
| Git | any | [git-scm.com](https://git-scm.com) |

---

## 1. MySQL Setup (Local)

### Option A — Native MySQL installation

1. Install MySQL 8 from [dev.mysql.com](https://dev.mysql.com/downloads/mysql/).
2. Start the MySQL service.
3. Create the database and run the schema:

```sql
-- In MySQL shell / Workbench
CREATE DATABASE IF NOT EXISTS incidenttrainingdb;
USE incidenttrainingdb;
source /path/to/incident-mysql-query.txt;
```

Or from your terminal:

```bash
mysql -u root -p < incident-mysql-query.txt
```

### Option B — Docker (no local MySQL install required)

```bash
docker run -d \
  --name incident-mysql \
  -e MYSQL_ROOT_PASSWORD=<root-password> \
  -e MYSQL_DATABASE=incidenttrainingdb \
  -e MYSQL_USER=<db-user> \
  -e MYSQL_PASSWORD=<db-password> \
  -p 3306:3306 \
  mysql:8.0
```

Wait ~30 seconds for MySQL to initialise, then load the schema:

```bash
docker exec -i incident-mysql mysql -u <db-user> -p<db-password> incidenttrainingdb < incident-mysql-query.txt
```

> Use the same `<db-user>` and `<db-password>` values you will set in `backend/.env` (`DB_USER` and `DB_PASS`).

---

## 2. Backend Setup

### 2a. Install dependencies

```bash
cd backend
npm install
```

### 2b. Configure environment variables

Create (or edit) `backend/.env`:

```env
# Local MySQL
DB_HOST=localhost
DB_USER=adosh_dev
DB_PASS=Adveti@2026
DB_NAME=incidenttrainingdb
APP_PORT=3001
```

> **Note:** The `db.js` pool is configured with `ssl: { rejectUnauthorized: false }`. For a plain local MySQL instance without SSL this is harmless — the driver will use a plain connection automatically.

### 2c. Load seed data

```bash
# From the repository root
mysql -u adosh_dev -pAdveti@2026 incidenttrainingdb < insert_performanceCriteria.txt
mysql -u adosh_dev -pAdveti@2026 incidenttrainingdb < insert_scenarioTbl.txt
mysql -u adosh_dev -pAdveti@2026 incidenttrainingdb < insert_exam_secnarioTbl.txt
mysql -u adosh_dev -pAdveti@2026 incidenttrainingdb < insert_questions.txt
mysql -u adosh_dev -pAdveti@2026 incidenttrainingdb < insert_exam_question.txt
mysql -u adosh_dev -pAdveti@2026 incidenttrainingdb < insert_userTbl.txt
```

### 2d. Start the backend

```bash
cd backend
node server.js
# or
npm start
```

The API server will start on **http://localhost:3001**. Verify it is working:

```bash
curl http://localhost:3001/api/scenarios
# Should return a JSON array
```

---

## 3. Frontend Setup

### 3a. Install dependencies

```bash
cd frontend
npm install
```

### 3b. Configure environment (development)

The file `frontend/.env.development` already points to the local backend:

```env
VITE_API_URL=http://localhost:3001
```

No changes are needed for a standard local setup.

### 3c. Start the dev server

```bash
cd frontend
npm run dev
```

Vite will start on **http://localhost:3000** and will automatically open the browser.

The Vite proxy in `vite.config.ts` forwards all `/api/*` requests to `http://localhost:3001`, so the frontend and backend communicate seamlessly during development.

---

## 4. LAN / WiFi Access

To allow other devices on the same network (e.g., other computers, tablets, or phones connected to the same WiFi) to access the application:

### 4a. Find your machine's local IP address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your active adapter, e.g. 192.168.1.105
```

**macOS / Linux:**
```bash
ifconfig | grep "inet "
# or
ip addr show
```

### 4b. Start the backend to listen on all interfaces

The Node.js backend binds to all network interfaces by default (no explicit `hostname` is set in `server.listen()`), so it is already reachable on your LAN IP.

```bash
cd backend
node server.js
# Backend now reachable at http://192.168.1.105:3001 from any device on the LAN
```

### 4c. Start the frontend with host binding

By default, Vite's dev server only listens on `localhost`. To expose it on the LAN, start it with the `--host` flag:

```bash
cd frontend
npm run dev -- --host
# Vite will print something like:
#   ➜  Local:   http://localhost:3000/
#   ➜  Network: http://192.168.1.105:3000/
```

### 4d. Update the frontend API base URL for LAN

When another device opens the frontend via `http://192.168.1.105:3000`, the browser will call the API relative to _that IP_, not `localhost`. The Vite proxy only works in the Vite dev process (on the host machine), not for external clients.

**For LAN/WiFi testing**, update `frontend/.env.development` to use your LAN IP:

```env
VITE_API_URL=http://<your-lan-ip>:3001
```

> Replace `<your-lan-ip>` with the IP address found in step 4a (e.g., `192.168.1.105`).

Then restart the Vite dev server. Remote devices will now call the backend directly on the LAN IP.

> **Revert when done:** Change `VITE_API_URL` back to `http://localhost:3001` when you return to local-only development.

### 4e. Windows Firewall — allow inbound connections

Windows Firewall may block inbound connections to ports 3000 and 3001. Allow them:

```powershell
# Allow backend (port 3001)
netsh advfirewall firewall add rule name="IncidentTraining-Backend" dir=in action=allow protocol=TCP localport=3001

# Allow frontend (port 3000)
netsh advfirewall firewall add rule name="IncidentTraining-Frontend" dir=in action=allow protocol=TCP localport=3000
```

Or open **Windows Defender Firewall → Advanced Settings → Inbound Rules → New Rule** and create rules for TCP ports 3000 and 3001.

---

## 5. Running Both Services Together

Open **two separate terminals**:

**Terminal 1 — Backend:**
```bash
cd backend
node server.js
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

| Service | Local URL | LAN/WiFi URL |
|---------|-----------|-------------|
| Frontend | http://localhost:3000 | http://\<your-lan-ip\>:3000 |
| Backend API | http://localhost:3001 | http://\<your-lan-ip\>:3001 |

### Verifying the setup

```bash
# Check backend is running
curl http://localhost:3001/api/scenarios

# Check login works
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"<orgUserId>","password":"<password>"}'
```

---

## Seed Data

The following SQL files contain seed data to populate the application:

| File | Contents |
|------|---------|
| `insert_userTbl.txt` | Default user accounts (students, faculty, admin) |
| `insert_scenarioTbl.txt` | Practice scenarios |
| `insert_exam_secnarioTbl.txt` | Exam scenarios |
| `insert_questions.txt` | Practice questions with answers |
| `insert_exam_question.txt` | Exam questions with answers |
| `insert_performanceCriteria.txt` | Performance criteria codes (PC1–PC5, etc.) |

> **Note:** Load `insert_performanceCriteria.txt` and scenario files **before** question files, as questions have foreign-key relationships to scenarios and PCs.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `CORS error` in browser | Backend CORS header mismatch | Verify `VITE_API_URL` and that the backend is running; check `Access-Control-Allow-Origin` header in response |
| `ECONNREFUSED` when backend starts | MySQL not running or wrong credentials | Start MySQL service; check `DB_HOST`, `DB_USER`, `DB_PASS` in `.env` |
| `ER_ACCESS_DENIED_ERROR` | Wrong DB credentials | Double-check `DB_USER` and `DB_PASS` in `backend/.env` |
| `ER_BAD_DB_ERROR` | Database does not exist | Run `CREATE DATABASE incidenttrainingdb;` then the DDL script |
| Port 3001 already in use | Another process on 3001 | Change `APP_PORT` in `backend/.env`; update `VITE_API_URL` accordingly |
| Port 3000 already in use | Another process on 3000 | Change `server.port` in `frontend/vite.config.ts` |
| LAN devices cannot reach the app | Windows Firewall blocking | Add inbound rules for ports 3000 and 3001 (see §4e above) |
| LAN devices get API errors | `VITE_API_URL` still set to `localhost` | Change to your LAN IP in `.env.development` and restart Vite |
| Azure backend returns 503 | App Service not started or startup command wrong | Check App Service logs in Azure portal; verify startup command is `node server.js` |
| Azure DB connection fails | Firewall rule missing | Add `AllowAzureServices` rule on the MySQL Flexible Server |
| `User not found` on login | Seed data not loaded | Run `insert_userTbl.txt` against the database |
| Static Web App shows blank page | Outdated `VITE_API_URL` in `.env.production` | Update URL, commit, push to `initial-draft` to trigger CI rebuild |


# IncidentTraining

A full-stack **incident response training application** featuring:

- **Frontend:** React + Vite + TypeScript  
- **Backend:** Node.js + MySQL  

Use this app to **simulate outages**, **practice triage and communication**, and **capture learning outcomes**.

---

## **Overview**

### **Frontend (React + Vite + TypeScript)**
- Entry HTML: frontend/index.html
- App bootstrap: frontend/src/main.tsx
- Main component: frontend/src/App.tsx
- API calls: frontend/src/api.ts
- Styles: frontend/src/index.css
- Vite config: frontend/vite.config.ts
- Build output: frontend/build/index.html
- Docs: frontend/README.md
- Attribution: frontend/src/Attributions.md

### **Backend (Node.js + MySQL)**
- Server entry: backend/server.js
- DB configuration/client: backend/db.js
- Environment variables: backend/.env
- Docs: backend/README.md

### **Misc**
- MySQL snippet: incident-mysql-query.txt

---

## **Requirements**
- **Node.js:** >= 18 (recommended)
- **npm:** Installed and available in your shell
- **MySQL:** Running instance (local or remote)
- **OS:** macOS (tested), Linux/Windows likely compatible

---

## **Quick Start**

```bash
# Install dependencies
cd frontend
npm install

cd ../backend
npm install

# Run backend (API)
cd backend
npm start   # or node server.js

# Run frontend (Vite dev server)
cd ../frontend
npm run dev
````

*   **Frontend dev server:** `http://localhost:5173` (default Vite port; configurable in `vite.config.ts`)
*   **Backend port:** Controlled by `PORT` in `backend/.env` or defaults in `server.js`

***

## **Configuration**

*   **Backend environment:** Set values in `backend/.env` (do not commit secrets)
    *   Keys: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`
*   **Frontend API base URL:** Configure in `frontend/src/api.ts`
*   **CORS:** Ensure backend sets appropriate headers if frontend and backend run on different ports

***

## **Project Structure**

    frontend/
      index.html
      src/
        main.tsx
        App.tsx
        api.ts
        index.css
        Attributions.md
      vite.config.ts
      build/
        index.html
      README.md

    backend/
      server.js
      db.js
      .env
      README.md

    incident-mysql-query.txt

***

## **Running**

### **Backend**

```bash
cd backend
npm start   # or node server.js
```

### **Frontend**

```bash
cd frontend
npm run dev
```

*   **Access the app:**
    *   Frontend: `http://localhost:5173`
    *   API: `http://localhost:<PORT>` (PORT from `.env` or `server.js`)

***

## **Build**

### **Frontend (Production)**

```bash
cd frontend
npm run build
```

*   Output: `frontend/build/`  
    Deploy to static hosting (e.g., Nginx, Netlify, Vercel, S3 + CloudFront).

### **Backend**

*   No build step for plain Node.js  
    Deploy by running `backend/server.js` with appropriate environment.

***

## **Development**

*   Run frontend and backend in separate terminals
*   **Lint/Format (if configured):**

```bash
# Frontend
cd frontend
npm run lint || echo "lint script not found"
npm run format || echo "format script not found"

# Backend
cd ../backend
npm run lint || echo "lint script not found"
npm run format || echo "format script not found"
```

*   **Environment handling:**
    *   Backend: `backend/.env`
    *   Frontend: Vite env files (e.g., `.env.development`) via `import.meta.env`

***

## **Database**

*   Configure MySQL in `backend/.env`
*   Validate connectivity using `incident-mysql-query.txt`
*   Consider adding migration/seed tooling (Knex, Prisma, or custom scripts)

***

## **Deployment**

*   **Frontend:** Deploy `frontend/build` to hosting provider
*   **Backend:** Run Node.js service on server/VM or container (PM2, systemd, Docker)
*   Consider adding `Dockerfile` and `docker-compose.yml` for local parity

***

## **Troubleshooting**

*   **CORS errors:** Configure backend CORS or align API base URL
*   **Port conflicts:** Change `PORT` in `backend/.env`; adjust Vite dev port in `vite.config.ts`
*   **DB connectivity:** Check credentials, host/port, firewall; test with `incident-mysql-query.txt`

***


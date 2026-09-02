# 🌐 POLAR-TWIN — Production Deployment Guide

This guide covers deploying the **Polar Twin** Antarctic Digital Twin application to production:
- **Frontend:** [Vercel](https://vercel.com) (React 19 + Three.js + Vite)
- **Backend:** [Render](https://render.com) or [Railway](https://railway.app) (FastAPI + WebSockets + ML Models + Background Simulation)

---

## 🏗️ Architecture Overview

```
                          ┌────────────────────────┐
                          │   Vercel Edge (CDN)    │
                          │   React 19 Frontend    │
                          └───────────┬────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │ HTTPS (/api/*)                                │ WSS (/ws/*)
              ▼                                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Render / Railway Web Service                          │
│                                                                             │
│  ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │   FastAPI REST API     │  │ WebSocket Manager     │  │ Simulation     │  │
│  │   (Endpoints & Docs)   │  │ (Live Telemetry Bus)  │  │ Worker Loop    │  │
│  └───────────┬────────────┘  └───────────┬───────────┘  └────────┬───────┘  │
│              │                           │                       │          │
│              ▼                           ▼                       ▼          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                  SQLAlchemy + Pre-trained RF Models                   │  │
│  │                (Auto-seeded Polar Stations Database)                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Why two hosts?**  
> Vercel is optimized for static assets and serverless functions, but serverless environments do not support persistent long-running background threads (the continuous 10s digital twin telemetry loop) or persistent WebSockets. Hosting the backend on **Render** / **Railway** provides a persistent container with native WebSocket and background simulation support.

---

## Part 1: Backend Deployment (Deploy First to get your API URL)

Deploy the backend first so you have your live `https://...` and `wss://...` URLs ready for Vercel.

### Option A: 1-Click / Blueprint on Render (Recommended)

1. Push your repository to **GitHub**.
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **New +** → **Web Service** (or **Blueprint**).
3. Connect your GitHub repository `POLAR-TWIN`.
4. Configure the Web Service settings:
   - **Name:** `polar-twin-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** `Free` (or `Starter`)
5. In **Environment Variables**, add:
   | Key | Value | Description |
   |---|---|---|
   | `ENVIRONMENT` | `production` | Production mode |
   | `SIMULATION_ENABLED` | `true` | Runs continuous 10s telemetry |
   | `SIMULATION_INTERVAL_SECONDS` | `10` | Frequency of simulation ticks |
   | `CORS_ORIGINS` | `["*"]` | Allows any Vercel domain |
   | `GROQ_API_KEY` | `your_groq_api_key` | (Optional) For AI Copilot |
   | `SECRET_KEY` | `generate-a-random-secret` | App security key |
6. Click **Create Web Service**.
7. Once deployed, Render provides your service URL:
   - **API URL:** `https://polar-twin-backend.onrender.com/api`
   - **WebSocket URL:** `wss://polar-twin-backend.onrender.com/ws`

---

### Option B: Railway Deployment

1. Go to [railway.app](https://railway.app) and create a **New Project** → **Deploy from GitHub repo**.
2. Set the **Root Directory** to `backend`.
3. Railway automatically detects the `Procfile` and `requirements.txt`.
4. Add the same environment variables as above (`CORS_ORIGINS=["*"]`, `ENVIRONMENT=production`).
5. Under **Settings** → **Networking**, click **Generate Domain**.

---

### Option C: Docker Container (Any Cloud / VPS)

Build and run using the included production [backend/Dockerfile](file:///c:/Users/adity/OneDrive/Documents/Polar%20Twin/backend/Dockerfile):

```bash
cd backend
docker build -t polar-twin-backend .
docker run -d -p 8000:8000 -e CORS_ORIGINS='["*"]' polar-twin-backend
```

---

## Part 2: Frontend Deployment on Vercel

Once your backend is live, deploy the frontend to Vercel:

### Method 1: Via Vercel Web Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import your `POLAR-TWIN` repository.
2. In the **Configure Project** screen:
   - **Project Name:** `polar-twin`
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend` (or leave default if using the root `vercel.json`).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Expand **Environment Variables** and add:
   | Key | Value | Note |
   |---|---|---|
   | `VITE_API_URL` | `https://your-backend.onrender.com/api` | Your deployed backend REST endpoint |
   | `VITE_WS_URL` | `wss://your-backend.onrender.com/ws` | Your deployed backend WebSocket endpoint |
   | `VITE_OPERATOR_ID` | `Operator_Antarctic_HQ` | Station operator ID |
4. Click **Deploy**.
5. Vercel will build the frontend and provision an edge SSL URL (e.g. `https://polar-twin.vercel.app`).

---

### Method 2: Via Vercel CLI

If you prefer deploying directly from your terminal:

1. Install the Vercel CLI if not already installed:
   ```bash
   npm i -g vercel
   ```
2. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
3. Run:
   ```bash
   vercel
   ```
4. Follow the interactive prompts:
   - Set up and deploy? **Yes**
   - Which scope? **Select your account**
   - Link to existing project? **No**
   - Project name? **polar-twin**
   - In which directory is your code located? **`./`**
5. For production release:
   ```bash
   vercel --prod
   ```

---

## Part 3: Production Checklist & Verification

After both frontend and backend are deployed:

- [ ] **SPA Route Traversal:** Refresh any subpage (e.g. `https://polar-twin.vercel.app/energy` or `https://polar-twin.vercel.app/operations`). The `vercel.json` rewrites ensure you never hit a 404.
- [ ] **3D Base Model:** The 3D Digital Twin loads and renders smoothly on the Mission Control dashboard.
- [ ] **Live Telemetry Stream:** The station status badge indicates live real-time connection (`ws://` / `wss://`).
- [ ] **Microgrid & Scenarios:** Injecting a scenario (e.g., Generator 1 Failure) immediately updates telemetry and triggers alerts.
- [ ] **AI Operations Copilot:** Asking questions in the Copilot drawer returns operational guidance.

---

## 🛠️ Updating Environment Variables in Vercel

If you ever change your backend domain:
1. Open your project on [vercel.com](https://vercel.com).
2. Go to **Settings** → **Environment Variables**.
3. Edit `VITE_API_URL` and `VITE_WS_URL`.
4. Go to **Deployments** → click the three dots on the latest deployment → **Redeploy**.

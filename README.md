# POLAR-TWIN — Antarctic Digital Twin & Remote Operations Platform

> **Indian Antarctic Research Stations (Maitri & Bharati)**  
> High-fidelity Digital Twin framework integrating infrastructure, microgrid power, logistics, and environmental telemetry for remote station management and decision support.

---

## ❄️ Platform Architecture

POLAR-TWIN is structured as a full-stack digital twin command center:

```
POLAR-TWIN/
├── backend/                  # FastAPI + SQLAlchemy + Physics Simulation Engine
│   ├── app/
│   │   ├── api/             # REST Endpoints (Dashboard, Energy, Operations, Commands, etc.)
│   │   ├── core/            # Config, Database, Security
│   │   ├── models/          # SQLAlchemy Database Models (Stations, Equipment, Energy, etc.)
│   │   ├── schemas/         # Pydantic v2 Contract Schemas
│   │   ├── services/        # Business Logic & Safety Interlock Engines
│   │   └── simulation/      # Physics-based Microgrid, Thermal & Weather Telemetry Engines
│   ├── tests/               # 44 Automated Unit & Integration Tests (100% Pass)
│   └── requirements.txt
│
└── frontend/                 # React + TypeScript + Vite + Tailwind CSS + Three.js
    ├── src/
    │   ├── api/             # Typed API Client & WebSocket Hooks
    │   ├── components/      # 3D Digital Twin, Command Modals, Layout
    │   └── pages/           # Command Center, Energy, Environment, Operations, etc.
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Quickstart Guide

### 1. Backend Service (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
* **API Documentation:** `http://localhost:8000/docs`
* **Root Health Check:** `http://localhost:8000/health`
* **Real-time WebSocket:** `ws://localhost:8000/ws/stations/2`

### 2. Frontend Command Center (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
* **Mission Control UI:** `http://localhost:5173`

---

## ⚡ Core Operational Features

1. **Mission Control Dashboard (`/`):**
   - Interactive **3D Digital Twin** (`Three.js` / `@react-three/fiber`) of the Antarctic base with live equipment status lights.
   - Real-time **Open-Meteo external polar meteorology** (temperature, katabatic wind, pressure).
   - Live **Microgrid Energy Datalink** (Diesel generation, solar PV, battery storage state of charge, net balance).
   - **What-If Scenario Injection Widget** (Generator Failure, Extreme Cold, High Demand).

2. **Energy Systems Center (`/energy`):**
   - Real-time generation vs. consumption balance.
   - Fractional battery electrochemical charging/discharging monitoring.
   - One-click load shedding (`NON_CRITICAL`, `HIGH_PRIORITY`) and load restoration.

3. **Operations & Actuator Controls (`/operations`):**
   - Direct control over station equipment (**`START`**, **`STOP`**, **`RESTART`**, **`ISOLATE`**).
   - Safety interlock validation preventing accidental shutdown of sole online generators.
   - **Command Preview & Authorization Modal** providing predicted energy deltas before execution.

---

## 🧪 Automated Testing
Run the backend test suite:
```bash
cd backend
pytest
```
* **44 Passed / 0 Failed** across alerts, commands, microgrid, load shedding, maintenance, logistics, and simulation.

---

## 📜 License
MIT License. Built for Antarctic Digital Twin Remote Operations.

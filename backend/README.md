# POLAR-TWIN — Antarctic Digital Twin Platform (Maitri & Bharati)

A production-ready, modular, and physics-connected Digital Twin backend for the Indian Antarctic research stations **Maitri** (Schirmacher Oasis, Queen Maud Land) and **Bharati** (Larsemann Hills, East Antarctica).

Built for remote management, real-time microgrid monitoring, consumable logistics tracking, automated multi-system anomaly detection, ML predictive energy forecasting, and interactive **What-If simulation scenario modeling**.

---

## 1. System Architecture & Modularity

The backend is engineered as a clean, monolithic FastAPI service with strict separation of concerns between HTTP routes, business services, simulation engines, declarative database models, and validation schemas:

```
backend/
├── app/
│   ├── main.py                     # FastAPI app factory, background worker lifespan, CORS, WebSockets
│   │
│   ├── core/
│   │   ├── config.py               # Pydantic BaseSettings, validated thresholds & CORS
│   │   ├── database.py             # SQLAlchemy 2.0 engine, Base, SessionLocal & get_db dependency
│   │   └── security.py             # Standardized error responses & security helpers
│   │
│   ├── models/                     # SQLAlchemy 2.0 Database Models
│   │   ├── station.py              # Stations (Maitri, Bharati)
│   │   ├── sensor.py               # Environmental telemetry time-series
│   │   ├── energy.py               # Microgrid generation, consumption, battery SoC
│   │   ├── equipment.py            # Vital infrastructure assets & runtime health
│   │   ├── logistics.py            # Consumables, fuel, rations, medical reserves
│   │   ├── alert.py                # System-generated multi-level alerts
│   │   └── prediction.py           # Historical predictions & forecast cache
│   │
│   ├── schemas/                    # Pydantic v2 validation and serialization schemas
│   │   ├── station.py              # StationOut, StationCreate
│   │   ├── sensor.py               # SensorTelemetryOut, HistoricalEnvironmentOut
│   │   ├── energy.py               # EnergyTelemetryOut, HistoricalEnergyOut
│   │   ├── equipment.py            # EquipmentOut, EquipmentHealthOut
│   │   ├── logistics.py            # LogisticsItemOut, LogisticsForecastOut
│   │   ├── alert.py                # AlertOut, AlertAcknowledge
│   │   ├── prediction.py           # EnergyForecastResponse, FuelDepletionForecastResponse
│   │   ├── simulation.py           # ScenarioRequest, ScenarioResponse, SimulationStatusOut
│   │   └── dashboard.py            # Unified StationDashboardOut payload
│   │
│   ├── api/                        # FastAPI Route Handlers (No raw business logic)
│   │   ├── stations.py             # /api/stations
│   │   ├── environment.py          # /api/stations/{id}/environment/*
│   │   ├── energy.py               # /api/stations/{id}/energy/*
│   │   ├── equipment.py            # /api/stations/{id}/equipment, /api/equipment/{id}/*
│   │   ├── logistics.py            # /api/stations/{id}/logistics/*
│   │   ├── alerts.py               # /api/stations/{id}/alerts, /api/alerts/*
│   │   ├── predictions.py          # /api/stations/{id}/predictions/*
│   │   ├── simulation.py           # /api/simulation/* (Scenarios, Start/Stop/Reset)
│   │   └── dashboard.py            # /api/stations/{id}/dashboard (Consolidated)
│   │
│   ├── services/                   # Business Logic & Calculation Layer
│   │   ├── station_service.py      # Station query & lookup
│   │   ├── simulation_service.py   # What-If scenario evaluations & simulation state
│   │   ├── energy_service.py       # Microgrid balance, power histories
│   │   ├── logistics_service.py    # Days remaining, resupply forecast
│   │   ├── prediction_service.py   # Scikit-learn 6/12/24h ML energy & fuel depletion models
│   │   ├── alert_service.py        # Automated anomaly evaluation & alert deduplication
│   │   └── weather_service.py      # WeatherProvider (External Open-Meteo + Antarctic Climate Fallback)
│   │
│   ├── simulation/                 # Physics-Connected Digital Twin Engines
│   │   ├── telemetry_engine.py     # Master coordinator cycle, sensor persistence, broadcasts
│   │   ├── energy_simulator.py     # Thermal heating loads, solar diurnal curves, battery/diesel dispatch
│   │   ├── equipment_simulator.py  # Thermal stress, runtime wear, efficiency degradation
│   │   └── logistics_simulator.py  # Daily attrition and consumable depletion
│   │
│   └── utils/
│       ├── calculations.py         # Deterministic equipment health score formula & safe division
│       └── validators.py           # Physical boundaries, percentage bounds, range clamping
│
├── tests/                          # Comprehensive Pytest Suite
│   ├── conftest.py                 # Isolated in-memory database fixture & TestClient
│   ├── test_stations.py
│   ├── test_environment.py
│   ├── test_energy.py
│   ├── test_equipment.py
│   ├── test_logistics.py
│   ├── test_alerts.py
│   ├── test_predictions.py
│   ├── test_simulation.py
│   └── test_dashboard.py
│
├── alembic/                        # Database migrations
├── .env.example                    # Sample environment variables
├── requirements.txt                # Python dependencies
├── seed.py                         # Deterministic 7-day realistic historical seeder
└── README.md
```

---

## 2. Technology Stack

- **Runtime**: Python 3.11+ / 3.12
- **Framework**: FastAPI (Asynchronous high-performance REST & WebSockets)
- **Database**: PostgreSQL with automatic zero-configuration SQLite fallback
- **ORM**: SQLAlchemy 2.0 (Modern mapped models)
- **Schema Validation**: Pydantic v2
- **Database Migrations**: Alembic
- **Machine Learning & Analytics**: `scikit-learn`, `numpy`, `pandas`
- **External HTTP**: `httpx`
- **Testing**: `pytest`
- **Web Server**: `uvicorn`

---

## 3. Data Provenance & Realism Notice

The Digital Twin maintains transparent data provenance across every response:
1. **Public Static Metadata**: Real, published geographic coordinates and station attributes for **Maitri** (`-70.767° S, 11.733° E`, 117m) and **Bharati** (`-69.407° S, 76.192° E`, 35m).
2. **External Weather Data**: Fetched from live meteorological feeds (Open-Meteo) with automatic in-memory caching (`source: "external_weather_api"`, `is_simulated: false`).
3. **Antarctic Climate Fallback**: High-fidelity mathematical climate model accounting for elevation lapse rate, seasonal angle, and katabatic wind dynamics if external network is unavailable (`source: "simulation"`, `is_simulated: true`).
4. **Microgrid Telemetry**: Physics-based interconnected simulations (`source: "simulation"`, `is_simulated: true`).
5. **Predictive Models**: Explicitly marked with horizons, confidence intervals, and model identifiers (`LightweightRidgeRegression` / `PhysicsDiurnalMovingAverage`).

---

## 4. Quickstart & Installation

### Step 1: Clone and Navigate to Backend
```bash
cd "Polar Twin/backend"
```

### Step 2: Create and Activate Virtual Environment
**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*Note: By default, `DATABASE_URL=sqlite:///./polar_twin.db` is ready for instant zero-configuration local development. To connect PostgreSQL, set `DATABASE_URL=postgresql://user:password@localhost:5432/polartwin`.*

### Step 5: Seed the Database with 7 Days of Telemetry
Run the deterministic seeder to populate Maitri, Bharati, all 7 infrastructure systems per station, logistics inventory, and 168 hours of historical telemetry:
```bash
python seed.py
```

### Step 6: Start the FastAPI Server
```bash
uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc Documentation: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

---

## 5. Running Automated Tests

Run the full pytest suite covering all stations, energy calculations, equipment health scoring, logistics burn, alert thresholds, ML predictions, simulation scenarios, and consolidated dashboards:

```bash
pytest -v
```

All 29 tests will execute against an isolated in-memory test database with 100% pass rate.

---

## 6. Physics-Connected Simulation Engine

The simulation loop runs asynchronously in the background every `SIMULATION_INTERVAL_SECONDS` (default: 10s) without blocking incoming API calls:

```
[Ambient Weather]  ──>  [HVAC Heating Demand]
                               │
                               ▼
[Solar PV Cycle]   ──>  [Total Station Consumption]  ──>  [Energy Balance (Gen - Con)]
                                                                  │
                     ┌────────────────────────────────────────────┴───────────────────────────┐
                     ▼                                                                        ▼
            [Surplus (Gen > Con)]                                                   [Deficit (Gen < Con)]
                     │                                                                        │
            [Battery Charges]                                                       [Battery Discharges]
                                                                                              │
                                                                                              ▼ (if Battery < 30%)
                                                                                    [Diesel Generator Spins Up]
                                                                                              │
                                                                                              ▼
                                                                                    [Fuel Tank Depletes]
                                                                                              │
                                                                                              ▼
                                                                                    [Equipment Runtime & Wear]
                                                                                              │
                                                                                              ▼
                                                                                    [Automated Alert Triggers]
```

### Available What-If Scenarios
| Scenario | Subsystem Impact | Simulated Effects |
|---|---|---|
| `NORMAL_OPERATION` | Microgrid Nominal | Standard diurnal cycles, optimal baseline operation |
| `GENERATOR_FAILURE` | Power Generation | Primary generator trips offline; battery buffers 120kW deficit; alert raised; backup recommendations generated |
| `EXTREME_COLD` | HVAC & Life Support | Ambient temp drops to -45°C; 95 km/h katabatic winds; thermal heating load surges by 65%; fuel burn increases |
| `HIGH_ENERGY_DEMAND` | Electrical Grid | Scientific deep core drilling active; base load spikes by +65kW; dual generator sync advised |
| `FUEL_SHORTAGE` | Fuel Logistics | Fuel reserve drops below 15%; critical resupply advisory generated; load shedding recommendations |
| `EQUIPMENT_DEGRADATION` | Mechanical Assets | Accelerated wear on HVAC/Generators; health score degrades < 60; filter & lube inspection required |
| `SUPPLY_DELAY` | Consumables | Supply ship delayed 45 days; rations and consumables conservation mode engaged |

---

## 7. Key API Endpoints Summary

### System & Health
- `GET /` - Digital Twin platform metadata and data provenance notice.
- `GET /health` - Health check, database connectivity, and active simulation status.

### Research Stations
- `GET /api/stations` - List all research stations (Maitri, Bharati).
- `GET /api/stations/{station_id}` - Station details by ID or code (`maitri` / `bharati`).

### Environment Telemetry
- `GET /api/stations/{station_id}/environment/current` - Live atmospheric telemetry (temperature, wind, pressure, humidity, visibility, provenance).
- `GET /api/stations/{station_id}/environment/history?limit=168` - Historical weather telemetry.

### Microgrid Energy
- `GET /api/stations/{station_id}/energy/current` - Live power generation, consumption, balance, battery SoC, fuel %.
- `GET /api/stations/{station_id}/energy/history?limit=168` - Historical energy generation and consumption time-series.
- `GET /api/stations/{station_id}/energy/forecast?horizon_hours=24` - Predictive 6h/12h/24h energy forecast with confidence bounds.

### Equipment & Subsystems
- `GET /api/stations/{station_id}/equipment` - All 7 vital subsystems (Generator 1 & 2, Battery Bank, HVAC, Water Treatment, Comms, Solar Array).
- `GET /api/equipment/{equipment_id}` - Equipment telemetry, runtime hours, operating temperature, efficiency.
- `GET /api/equipment/{equipment_id}/health` - Deterministic diagnostic health score (0-100), contributing penalty factors, and specific maintenance recommendations.

### Logistics & Consumables
- `GET /api/stations/{station_id}/logistics` - Consumable inventory list (Fuel, Food, Medical, Spares, Water) with daily consumption and days remaining.
- `GET /api/stations/{station_id}/logistics/forecast` - Inventory status, critical threshold alerts (<15 days), and resupply prioritization.

### Alerts & Anomaly Detection
- `GET /api/stations/{station_id}/alerts` - Station alerts history.
- `GET /api/alerts/active` - Active unacknowledged warnings and critical alerts.
- `PATCH /api/alerts/{alert_id}/acknowledge` - Acknowledge active alert.

### Predictive Intelligence
- `GET /api/stations/{station_id}/predictions` - Combined energy & fuel forecasts.
- `GET /api/stations/{station_id}/predictions/energy` - ML energy consumption projection.
- `GET /api/stations/{station_id}/predictions/fuel` - Fuel depletion projection (days until critical 10% threshold, projected empty date, resupply recommendation).

### Simulation & What-If Engine
- `GET /api/simulation/status` - Live simulation cycle status and active scenarios.
- `POST /api/simulation/start` - Resume simulation cycle.
- `POST /api/simulation/stop` - Pause simulation cycle.
- `POST /api/simulation/reset` - Reset all stations to `NORMAL_OPERATION`.
- `POST /api/simulation/scenario` - Execute What-If scenario (returns projected impacts, affected subsystems, and operational recommendations).

### Unified Dashboard Aggregator
- `GET /api/stations/{station_id}/dashboard` - **Single high-performance endpoint returning the complete Digital Twin state** (station, live environment, microgrid energy, equipment, logistics, alerts, predictions, simulation).

### Real-Time WebSocket Streaming
- `WebSocket /ws/stations/{station_id}` - Real-time push updates broadcast whenever simulation cycles tick.

---

## 8. Example API Payloads

### 1. Triggering a What-If Scenario (`POST /api/simulation/scenario`)
**Request:**
```json
{
  "station_id": "bharati",
  "scenario": "GENERATOR_FAILURE",
  "duration_minutes": 60,
  "apply_to_live": true
}
```

**Response:**
```json
{
  "station_id": 2,
  "station_code": "BHARATI",
  "scenario": "GENERATOR_FAILURE",
  "impact": {
    "energy_deficit_kw": 120.0,
    "battery_drop_percent": 18.5,
    "fuel_consumption_change_percent": -15.0,
    "grid_stability_risk": "HIGH"
  },
  "affected_systems": [
    "Microgrid Power Generation",
    "Battery Storage Bank",
    "Auxiliary Life Support"
  ],
  "recommendations": [
    "Recommendation: Operator should dispatch and start backup Generator 2 to restore microgrid generation capacity.",
    "Recommendation: Shed non-essential laboratory and auxiliary electrical loads to reduce battery discharge rate.",
    "Recommendation: Verify battery state-of-charge to ensure black-start reserve threshold (>10%) is maintained."
  ],
  "applied_to_simulation": true,
  "active_until": "2026-08-25T16:30:00Z"
}
```

### 2. Equipment Diagnostic Health (`GET /api/equipment/1/health`)
**Response:**
```json
{
  "equipment_id": 1,
  "equipment_name": "Generator 1",
  "equipment_type": "GENERATOR",
  "health_score": 92.5,
  "status": "NORMAL",
  "contributing_factors": [
    "Slightly above nominal operating temperature (72.0°C)",
    "Moderate cumulative runtime (2400 hrs)"
  ],
  "recommendation": "Monitor system parameters and schedule routine servicing.",
  "updated_at": "2026-08-25T15:30:00Z"
}
```

### 3. Fuel Depletion Forecast (`GET /api/stations/bharati/predictions/fuel`)
**Response:**
```json
{
  "station_id": 2,
  "station_code": "BHARATI",
  "current_fuel_percentage": 68.5,
  "current_fuel_liters": 41100.0,
  "estimated_daily_consumption_liters": 1100.0,
  "days_until_critical": 31.9,
  "critical_threshold_percentage": 10.0,
  "projected_critical_date": "2026-09-26T15:30:00Z",
  "projected_depletion_date": "2026-10-02T15:30:00Z",
  "recommended_resupply": false,
  "status": "NORMAL",
  "advisory_notes": "Projected fuel consumption remains within safe operational envelope for the current expedition season."
}
```

---

## 9. Digital Twin Calculation & Prediction Logic

### 1. Energy Balance Equation
```
energy_balance = generation_kw - consumption_kw
```
- **Total Generation**: `solar_generation_kw + diesel_generation_kw` (strictly $\ge 0.0$ kW)
- **Total Consumption**: `base_station_load + hvac_thermal_load + auxiliary_loads` (strictly $\ge 0.0$ kW)
- When `energy_balance > 0`: Net surplus power charges the station battery bank (`+battery_power_kw`).
- When `energy_balance < 0`: Net power deficit discharges the battery bank (`-battery_power_kw`).

### 2. Battery Storage Dynamics
- **Capacity**: Bharati = 300 kWh, Maitri = 350 kWh.
- **State of Charge Bounds**: Strictly clamped $0.0\% \le \text{SoC} \le 100.0\%$.
- **Charge Efficiency**: 90% round-trip efficiency during surplus charging.
- **Discharge Loss**: 92% efficiency under inverter discharge loads.
- **Delta SoC**: 
  $$\Delta \text{SoC} = \frac{P_{\text{battery}} \times (\Delta t / 3600)}{\text{Capacity}_{\text{kWh}}} \times 100$$

### 3. Fuel Depletion & Burn Modeling
- **Specific Fuel Consumption**: $0.26 \text{ Liters per kWh}$ of active diesel power generated.
- **Usable Fuel Above Critical**: $\max(0, \text{Current Liters} - (\text{Capacity} \times \text{Critical Threshold}))$.
- **Days Until Critical (10%)**: 
  $$\text{Days}_{\text{critical}} = \frac{\text{Current Liters} - \text{Critical Liters}}{\text{Estimated Daily Consumption (L/day)}}$$
  *(Protected against division-by-zero, returning 999.0 days when consumption is zero).*

### 4. Deterministic Equipment Health Diagnostic Formula
Health score ($0 - 100$) is computed via a multi-factor penalty model:
$$\text{Health Score} = 100 - (\text{Temp Penalty} + \text{Efficiency Penalty} + \text{Runtime Penalty} + \text{Maintenance Penalty})$$
- **Temperature Penalty**: Triggers when operating temperature exceeds nominal threshold ($>70^\circ\text{C}$ for generators, $>40^\circ\text{C}$ for HVAC).
- **Efficiency Penalty**: Scaled linearly when efficiency drops below $85\%$.
- **Runtime Penalty**: Scaled logarithmically for high cumulative runtimes ($>3,000$ and $>6,000$ hours).
- **Maintenance Penalty**: Triggered when routine servicing is overdue ($>180$ days since last service).
- **Trip/Failure Mode**: If equipment status is `OFFLINE`, health is clamped to $\le 25.0$ and marked `CRITICAL`.

### 5. Multi-System Anomaly & Alert Engine
- **Battery**: SoC $< 20\%$ (`WARNING`), $< 10\%$ (`CRITICAL`).
- **Fuel**: Tank level $< 20\%$ (`WARNING`), $< 10\%$ (`CRITICAL`).
- **Equipment**: Health score $< 60$ (`WARNING`), $< 30$ or `OFFLINE` (`CRITICAL`).
- **Energy Deficit**: Sustained deficit ($<-20\text{ kW}$ and battery $<30\%$) (`WARNING`).
- **Environment**: Katabatic wind $\ge 65\text{ km/h}$ (`WARNING`), $\ge 90\text{ km/h}$ (`CRITICAL`), temp $\le -42^\circ\text{C}$ (`WARNING`).
- **Deduplication**: Suppresses identical unacknowledged alerts within a 15-minute sliding window.

### 6. Energy Consumption Machine Learning Model
- **Model Name**: `LightweightRidgeRegression` (with `PhysicsDiurnalMovingAverage` fallback).
- **Input Features**: `[sin(2π·hour/24), cos(2π·hour/24), day_of_week, temperature, wind_speed]`.
- **Target Variable**: Station power consumption (`consumption_kw`).
- **Prediction Horizons**: 6-hour, 12-hour, and 24-hour forward intervals.
- **Uncertainty Envelope**: $\pm 8\%$ error margin confidence bands ($92\%$ confidence score).
- **Fallback Trigger**: Activated automatically if fewer than 24 historical hours exist in database.

### 7. What-If Scenario Causal Propagation
1. **Trigger Scenario**: `POST /api/simulation/scenario` sets active scenario state for target station.
2. **Cycle Tick**: Background worker executes `TelemetryEngine.execute_simulation_cycle`:
   - `GENERATOR_FAILURE`: Generator 1 trips `OFFLINE` $\rightarrow$ diesel generation drops to $0\text{ kW}$ $\rightarrow$ energy balance drops to deficit ($\approx -85\text{ kW}$) $\rightarrow$ battery bank discharges $\rightarrow$ `Equipment Offline` alert is generated.
   - `EXTREME_COLD`: Weather overrides to $-45^\circ\text{C}$ and $95\text{ km/h}$ $\rightarrow$ HVAC thermal heating load surges by $65\%$ $\rightarrow$ consumption spikes $\rightarrow$ Blizzard and Deep Freeze alerts generated.
3. **Reset**: `POST /api/simulation/reset` deterministic restore clears active failure flags, resets equipment to nominal, inserts healthy baseline telemetry, and acknowledges outage alarms.

### 8. Simulation Time & Wall-Clock Discretization
- **Tick Interval**: Configurable via `SIMULATION_INTERVAL_SECONDS` (default: 10s).
- **Time Step ($\Delta t$)**: $10.0\text{ seconds}$ per simulation step. Runtime hours and consumable attrition scale with $\Delta t / 3600.0$ and $\Delta t / 86400.0$ to ensure realistic physical progression.

### 9. Data Provenance Separation
Every API payload includes explicit data origin flags:
- `is_simulated: true`, `source: "simulation"` / `"historical_record"`: Mathematical microgrid & climate models.
- `is_simulated: false`, `source: "external_weather_api"`: Live Open-Meteo meteorological station queries.

---

## 10. Remote Management & Operations Layer

The platform includes a dedicated **Remote Management & Decision-Support Operations Layer** that transforms the Digital Twin from a passive monitoring dashboard into a closed-loop remote operations platform:

$$\text{OBSERVE} \rightarrow \text{DETECT} \rightarrow \text{PREDICT} \rightarrow \text{RECOMMEND} \rightarrow \text{PREVIEW} \rightarrow \text{AUTHORIZE} \rightarrow \text{EXECUTE} \rightarrow \text{VERIFY} \rightarrow \text{AUDIT}$$

> [!NOTE]
> **Safety Notice:** All remote commands strictly modify the **simulated Digital Twin state**. The backend clearly labels all actuator modifications and operations as virtual actions.

---

### 1. Command Execution Pipeline
Every operator command traverses a strict 7-stage validation pipeline:
```
Operator Request
       ↓
Input & Parameter Validation
       ↓
Target Asset Validation
       ↓
Safety Interlock Checks (SafetyService)
       ↓
Digital Twin State Transition
       ↓
Microgrid & Physics Recalculation
       ↓
Immutable Audit Log & WebSocket Broadcast
```

---

### 2. Safety Interlocks & Rules
- **Single Generator Protection (`409 Conflict`)**: Prohibits stopping the sole active generator if backup generation is not synchronized, preventing catastrophic station blackout.
- **Tripped Equipment Fault Lockout (`409 Conflict`)**: Prevents restarting an `OFFLINE` failed equipment until a scheduled maintenance task clears the fault.
- **Critical Load Group Protection (`409 Conflict`)**: Disallows shedding essential life support, primary HVAC, or satellite communications circuits.
- **Load Restoration Capacity Check (`409 Conflict`)**: Validates available microgrid generation headroom before allowing shed loads to be restored.
- **Role-Based Permissions**: Strict authorization enforcement (`VIEWER`, `OPERATOR`, `SUPERVISOR`, `ADMIN`).

---

### 3. Generator Management & State Transitions
- **State Machine**: `OFFLINE` $\leftrightarrow$ `STANDBY` $\rightarrow$ `STARTING` $\rightarrow$ `ONLINE` $\rightarrow$ `STOPPING`.
- **Start Generator**: `POST /api/stations/{id}/commands/generators/{equipment_id}/start`
- **Stop Generator**: `POST /api/stations/{id}/commands/generators/{equipment_id}/stop`

---

### 4. Electrical Load Management & Load Shedding
- **Load Groups**:
  - `CRITICAL` (Life Support, Primary HVAC Loop, Desalination, Satellite Comms) — *Non-sheddable*.
  - `HIGH_PRIORITY` (Deep Ice Core Freezers, LIDAR/Radar Arrays) — *Sheddable during critical deficit*.
  - `NON_CRITICAL` (Recreation/Sauna Module, Living Quarters Lighting, Workshop Tools) — *Sheddable*.
- **Load Shedding**: `POST /api/stations/{id}/commands/load-shed`
- **Load Restoration**: `POST /api/stations/{id}/commands/load-restore`
- **Inspect Loads**: `GET /api/stations/{id}/loads`

---

### 5. Operational Recommendations & Direct Execution
- **Recommendation Engine**: Analyzes live telemetry anomalies and generates actionable recommendations (`GET /api/stations/{id}/recommendations`).
- **One-Click Execution**: `POST /api/recommendations/{id}/execute` automatically runs safety validation, applies the command to the Digital Twin, transitions recommendation to `EXECUTED`, and logs an audit entry.

---

### 6. Command Simulation Preview
Operators can preview projected system impact before executing high-impact commands:
- **Endpoint**: `POST /api/stations/{id}/commands/preview`
- **Request Body**:
  ```json
  {
    "command_type": "START_GENERATOR",
    "target_id": 2
  }
  ```
- **Response**:
  ```json
  {
    "command_type": "START_GENERATOR",
    "safe": true,
    "requires_confirmation": false,
    "current_state": {
      "generation_kw": 14.0,
      "consumption_kw": 98.8,
      "energy_balance_kw": -84.8,
      "grid_status": "EMERGENCY"
    },
    "projected_state": {
      "target_equipment": "Generator 2",
      "target_status": "ONLINE",
      "projected_generation_kw": 104.0,
      "projected_energy_balance_kw": 5.2,
      "projected_grid_status": "ONLINE"
    },
    "impact": {
      "generation_change_kw": 90.0,
      "energy_balance_change_kw": 90.0,
      "battery_discharge_reduction_kw": 84.8
    },
    "warnings": [],
    "recommendations": [
      "Starting generator will eliminate microgrid power deficit and halt battery depletion."
    ]
  }
  ```

---

### 7. Maintenance & Logistics Workflows
- **Create Maintenance Task**: `POST /api/stations/{id}/maintenance`
- **Complete Maintenance Task**: `PATCH /api/maintenance/{id}/complete`
- **Create Resupply Request**: `POST /api/stations/{id}/logistics/resupply`
- **List Resupply Requests**: `GET /api/stations/{id}/logistics/resupply`

---

### 8. Immutable Audit Trail & History
- **Endpoint**: `GET /api/stations/{id}/operations/history?limit=50`
- Records every operator action, target asset, timestamp, previous state, resulting state, and execution outcome.



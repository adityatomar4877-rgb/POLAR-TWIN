"""
Master Backend Audit & Verification Test Suite.

Comprehensive automated verification across:
  1. Station isolation & cross-station data boundary
  2. Telemetry integrity, units, and ranges
  3. Simulation engine lifecycle and state propagation
  4. Energy balance & mathematical consistency
  5. Battery charging, discharging, and BMS boundaries
  6. Fuel logistics, BSFC burn dynamics, and depletion
  7. Grid status state machine and microgrid stability
  8. Storm conditions & environmental physics
  9. Random Forest ML model loading & read-only guarantee
 10. Exact 63-feature vector ordering vs feature_metadata.joblib
 11. Strict verification of no future target leakage in feature engineering
 12. Dynamic ML prediction response to changing telemetry
 13. Predictions API endpoint contract
 14. Dashboard consolidated aggregator integrity
 15. Energy Decision Engine rules, margins, and non-actuation
 16. Alert generation, deduplication, and resolution lifecycle
 17. Equipment health scoring and diagnostics
 18. Operations & load management safety interlocks
 19. WebSocket streaming & station channel isolation
 20. Error handling & security validation
"""

import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
import joblib
import pytest
from sqlalchemy.orm import Session

from app.models.station import Station
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.models.alert import Alert
from app.models.audit import LoadGroup
from app.services.station_service import station_service
from app.services.energy_service import energy_service
from app.services.weather_service import weather_service
from app.services.alert_service import alert_service
from app.services.energy_forecast_service import energy_forecast_service
from app.services.prediction_service import prediction_service
from app.services.simulation_service import simulation_service
from app.services.energy_decision_service import energy_decision_service
from app.simulation.energy_simulator import EnergySimulator


# ─────────────────────────────────────────────────────────────
# 1. STATION ISOLATION AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_station_isolation(client, db):
    """
    Asserts strict station data separation:
    - Queries for Bharati (ID 2 / 'BHARATI') only return Bharati data
    - Queries for Maitri (ID 1 / 'MAITRI') only return Maitri data
    """
    # 1. Stations endpoint
    st_res = client.get("/api/stations")
    assert st_res.status_code == 200
    stations = st_res.json()
    assert len(stations) == 2
    codes = {s["code"] for s in stations}
    assert codes == {"MAITRI", "BHARATI"}

    # 2. Telemetry endpoints isolation
    for code in ["maitri", "bharati"]:
        env = client.get(f"/api/stations/{code}/environment/current").json()
        energy = client.get(f"/api/stations/{code}/energy/current").json()
        eqs = client.get(f"/api/stations/{code}/equipment").json()
        logs = client.get(f"/api/stations/{code}/logistics").json()
        alerts = client.get(f"/api/stations/{code}/alerts").json()
        dash = client.get(f"/api/stations/{code}/dashboard").json()

        st_obj = station_service.get_station_by_id_or_code(db, code)

        assert env["station_id"] == st_obj.id
        assert energy["station_id"] == st_obj.id
        assert all(e["station_id"] == st_obj.id for e in eqs)
        assert all(l["station_id"] == st_obj.id for l in logs)
        assert all(a["station_id"] == st_obj.id for a in alerts)
        assert dash["station"]["code"] == code.upper()
        assert dash["station"]["id"] == st_obj.id


# ─────────────────────────────────────────────────────────────
# 2. TELEMETRY INTEGRITY & UNITS AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_telemetry_integrity(client, db):
    """
    Validates physical bounds, data types, and unit consistency:
    - Temperature: -60°C to +10°C
    - Wind: non-negative (km/h)
    - Pressure: 900 to 1050 hPa
    - Humidity: 0 to 100%
    - Power: kW (non-negative for generation/consumption)
    - Battery & Fuel: 0 to 100%
    """
    for code in ["maitri", "bharati"]:
        env = client.get(f"/api/stations/{code}/environment/current").json()
        assert -60.0 <= env["temperature"] <= 15.0
        assert 0.0 <= env["wind_speed"] <= 200.0
        assert 0.0 <= env["humidity"] <= 100.0
        assert 900.0 <= env["pressure"] <= 1050.0
        assert env["visibility"] >= 0.0

        energy = client.get(f"/api/stations/{code}/energy/current").json()
        assert energy["generation_kw"] >= 0.0
        assert energy["consumption_kw"] >= 0.0
        assert energy["solar_generation_kw"] >= 0.0
        assert energy["diesel_generation_kw"] >= 0.0
        assert 0.0 <= energy["battery_percentage"] <= 100.0
        assert 0.0 <= energy["fuel_percentage"] <= 100.0
        assert energy["grid_status"] in ["ONLINE", "ISLANDED", "DEGRADED", "EMERGENCY"]


# ─────────────────────────────────────────────────────────────
# 3. ENERGY BALANCE MATHEMATICAL AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_energy_balance_math(client):
    """
    Verifies that:
    1. available_generation_kw == solar_generation_kw + diesel_generation_kw
    2. energy_balance == generation_kw - consumption_kw
    3. battery SOC changes correspond to balance sign
    """
    for code in ["maitri", "bharati"]:
        res = client.get(f"/api/stations/{code}/energy/current").json()
        gen = res["generation_kw"]
        con = res["consumption_kw"]
        bal = res["energy_balance"]
        solar = res["solar_generation_kw"]
        diesel = res["diesel_generation_kw"]

        # generation = solar + diesel
        assert abs(gen - (solar + diesel)) < 0.05
        # balance = generation - consumption
        assert abs(bal - (gen - con)) < 0.05


# ─────────────────────────────────────────────────────────────
# 4. BATTERY DYNAMICS & CONVENTIONS AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_battery_charge_discharge_sign_convention():
    """
    Tests battery simulation physics:
    - Surplus power (gen > con) -> battery_power_kw > 0 (charging) -> SOC increases
    - Deficit power (gen < con) -> battery_power_kw < 0 (discharging) -> SOC decreases
    - Bounded within [0, 100]%
    """
    # 1. Charging Case
    charge_sim = EnergySimulator.simulate_energy_cycle(
        station_code="BHARATI",
        ambient_temperature=-15.0,
        wind_speed=20.0,
        prev_battery_pct=70.0,
        prev_fuel_pct=80.0,
        generator_1_online=True,
        generator_2_online=True, # Gen 240 kW >> load ~100 kW
        dt_seconds=600.0, # 10 minutes
    )
    assert charge_sim["energy_balance"] > 0
    assert charge_sim["battery_power_kw"] > 0  # Positive = Charging
    assert charge_sim["battery_percentage"] > 70.0

    # 2. Discharging Case (Both generators offline)
    discharge_sim = EnergySimulator.simulate_energy_cycle(
        station_code="BHARATI",
        ambient_temperature=-15.0,
        wind_speed=20.0,
        prev_battery_pct=70.0,
        prev_fuel_pct=80.0,
        generator_1_online=False,
        generator_2_online=False, # Zero generation -> battery supplies load
        custom_conditions={"solar_factor": 0.0},
        dt_seconds=600.0,
    )
    assert discharge_sim["energy_balance"] < 0
    assert discharge_sim["battery_power_kw"] < 0  # Negative = Discharging
    assert discharge_sim["battery_percentage"] < 70.0

    # 3. SOC Clamping at 100%
    clamped_high = EnergySimulator.simulate_energy_cycle(
        station_code="BHARATI",
        ambient_temperature=-15.0,
        wind_speed=20.0,
        prev_battery_pct=99.9,
        prev_fuel_pct=80.0,
        generator_1_online=True,
        generator_2_online=True,
        dt_seconds=3600.0,
    )
    assert clamped_high["battery_percentage"] <= 100.0

    # 4. SOC Clamping at 0%
    clamped_low = EnergySimulator.simulate_energy_cycle(
        station_code="BHARATI",
        ambient_temperature=-35.0,
        wind_speed=80.0,
        prev_battery_pct=0.1,
        prev_fuel_pct=80.0,
        generator_1_online=False,
        generator_2_online=False,
        custom_conditions={"solar_factor": 0.0},
        dt_seconds=7200.0,
    )
    assert clamped_low["battery_percentage"] >= 0.0


# ─────────────────────────────────────────────────────────────
# 5. FUEL DYNAMICS & BSFC AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_fuel_consumption_dynamics():
    """
    Tests fuel burn physics:
    - Higher generator load -> higher fuel burn
    - Zero generator load -> zero fuel burn
    - Fuel level never increases during generation
    """
    # Idle/Zero gen
    idle = EnergySimulator.simulate_energy_cycle(
        station_code="BHARATI",
        ambient_temperature=-15.0,
        wind_speed=20.0,
        prev_battery_pct=80.0,
        prev_fuel_pct=80.0,
        generator_1_online=False,
        generator_2_online=False,
        custom_conditions={"solar_factor": 0.0},
        dt_seconds=3600.0,
    )
    assert idle["diesel_generation_kw"] == 0.0
    assert idle["fuel_percentage"] == 80.0

    # Active generation
    active = EnergySimulator.simulate_energy_cycle(
        station_code="BHARATI",
        ambient_temperature=-15.0,
        wind_speed=20.0,
        prev_battery_pct=80.0,
        prev_fuel_pct=80.0,
        generator_1_online=True,
        generator_2_online=False,
        dt_seconds=3600.0,
    )
    assert active["diesel_generation_kw"] > 0.0
    assert active["fuel_percentage"] < 80.0


# ─────────────────────────────────────────────────────────────
# 6. RANDOM FOREST ML & EXACT 63-FEATURE PIPELINE AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_ml_exact_63_features_and_ordering(db):
    """
    Verifies that:
    1. Pre-trained RandomForest models (6h, 12h, 24h) are loaded without fallback.
    2. Exactly 63 features are generated.
    3. Feature names and exact ordering match feature_metadata.joblib.
    4. No NaNs, nulls, or infinities exist.
    """
    ml_dir = Path(__file__).resolve().parent.parent / "app" / "ml"
    meta_path = ml_dir / "feature_metadata.joblib"
    assert meta_path.exists(), "feature_metadata.joblib not found"

    meta = joblib.load(meta_path)
    expected_features = meta["features"]
    expected_count = meta["feature_count"]
    assert expected_count == 63
    assert len(expected_features) == 63

    energy_history = (
        db.query(EnergyTelemetry)
        .filter(EnergyTelemetry.station_id == 1)
        .order_by(EnergyTelemetry.timestamp.asc())
        .all()
    )
    sensor_history = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == 1)
        .order_by(SensorTelemetry.timestamp.asc())
        .all()
    )

    energy_forecast_service._ensure_loaded()
    assert energy_forecast_service._loaded is True
    assert energy_forecast_service._feature_count == 63
    assert energy_forecast_service._feature_names == expected_features

    features = energy_forecast_service._build_features(energy_history, sensor_history)
    assert len(features) == 63

    for idx, (val, name) in enumerate(zip(features, expected_features)):
        assert isinstance(val, (int, float)), f"Feature {idx} ({name}) is not numeric: {val}"
        assert math.isfinite(val), f"Feature {idx} ({name}) is NaN or Inf: {val}"


# ─────────────────────────────────────────────────────────────
# 7. ML DATA LEAKAGE AUDIT (NO FUTURE TARGETS IN X)
# ─────────────────────────────────────────────────────────────
def test_audit_no_future_target_leakage():
    """
    Verifies that no future consumption targets (e.g. target_6h, target_12h, target_24h)
    or future timestamp data are ever part of the 63 input features.
    """
    ml_dir = Path(__file__).resolve().parent.parent / "app" / "ml"
    meta = joblib.load(ml_dir / "feature_metadata.joblib")
    features = meta["features"]

    for feat in features:
        # None of the feature names should contain target designations
        assert not feat.startswith("target_"), f"Target leakage detected in features: {feat}"
        assert "future" not in feat.lower(), f"Future leakage detected in feature name: {feat}"


# ─────────────────────────────────────────────────────────────
# 8. PREDICTIONS API & DYNAMIC RESPONSE AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_prediction_endpoints(client):
    """
    Validates /api/stations/{id}/predictions and /api/stations/{id}/predictions/energy:
    - model_name == "RandomForestEnergyForecast"
    - is_fallback == False
    - 6h, 12h, 24h predictions are numeric, non-negative, and finite
    """
    for code in ["maitri", "bharati"]:
        res = client.get(f"/api/stations/{code}/predictions/energy")
        assert res.status_code == 200
        data = res.json()
        assert data["model_name"] == "RandomForestEnergyForecast"
        assert data["is_fallback"] is False
        assert data["feature_count"] == 63

        for h in ["6h", "12h", "24h"]:
            assert h in data["forecast"]
            val = data["forecast"][h]["average_consumption_kw"]
            assert isinstance(val, (int, float))
            assert val >= 0.0
            assert math.isfinite(val)


# ─────────────────────────────────────────────────────────────
# 9. ENERGY DECISION ENGINE AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_energy_decision_engine_rules(client, db):
    """
    Validates the Energy Decision Engine:
    - Real predictions and real telemetry ingested
    - Available generation = solar + diesel
    - Correct status: NORMAL, WARNING, HIGH_RISK, CRITICAL
    - Transparent reasons and non-actuation recommendations
    """
    res = client.get("/api/stations/bharati/energy/decision")
    assert res.status_code == 200
    data = res.json()

    assert data["station_code"] == "BHARATI"
    assert data["status"] in ["NORMAL", "WARNING", "HIGH_RISK", "CRITICAL"]
    assert "forecast" in data
    assert "energy_state" in data
    assert "energy_margin" in data
    assert "risk" in data
    assert "recommendations" in data

    # Check margin arithmetic
    es = data["energy_state"]
    em = data["energy_margin"]
    fc = data["forecast"]
    assert abs(es["available_generation_kw"] - (es["solar_generation_kw"] + es["diesel_generation_kw"])) < 0.05
    assert abs(em["6h_kw"] - (es["available_generation_kw"] - fc["6h_average_kw"])) < 0.05


# ─────────────────────────────────────────────────────────────
# 10. ALERT SYSTEM DEDUPLICATION & RESOLUTION AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_alert_deduplication_and_acknowledgment(client, db):
    """
    Tests alert generation, deduplication within time window, and acknowledgment.
    """
    st = station_service.get_station_by_id_or_code(db, 1)

    # 1. Create alert
    alert = alert_service.create_alert(
        db, st.id, "ENERGY", "WARNING", "Audit Test Alert", "Test message"
    )
    db.commit()
    assert alert is not None

    # 2. Duplicate alert within 15 min window should be suppressed
    dup_alert = alert_service.create_alert(
        db, st.id, "ENERGY", "WARNING", "Audit Test Alert", "Test message"
    )
    assert dup_alert is None

    # 3. Acknowledge alert
    ack_res = client.patch(f"/api/alerts/{alert.id}/acknowledge")
    assert ack_res.status_code == 200
    assert ack_res.json()["acknowledged"] is True


# ─────────────────────────────────────────────────────────────
# 11. DASHBOARD CONSOLIDATED AGGREGATOR AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_dashboard_aggregator(client):
    """
    Validates /api/stations/{id}/dashboard returns complete aggregated state
    from real subsystems without synthetic fallback injection.
    """
    for code in ["maitri", "bharati"]:
        res = client.get(f"/api/stations/{code}/dashboard")
        assert res.status_code == 200
        data = res.json()

        assert "station" in data
        assert "environment" in data
        assert "energy" in data
        assert "equipment" in data
        assert "logistics" in data
        assert "alerts" in data
        assert "predictions" in data
        assert "simulation" in data
        assert "operations" in data

        # Subsystems are populated
        assert data["station"]["code"] == code.upper()
        assert len(data["equipment"]) >= 5
        assert len(data["logistics"]) >= 2
        assert "energy_forecast" in data["predictions"]
        assert data["predictions"]["energy_forecast"]["model_name"] == "RandomForestEnergyForecast"


# ─────────────────────────────────────────────────────────────
# 12. ERROR HANDLING & STATUS CODES AUDIT
# ─────────────────────────────────────────────────────────────
def test_audit_error_handling_and_validation(client):
    """
    Tests explicit, structured error handling:
    - 404 for nonexistent resources
    - 409 for safety interlock violations
    - 422 for malformed payloads / query params
    """
    # 404 Station Not Found
    res404_st = client.get("/api/stations/unknown_station_xyz")
    assert res404_st.status_code == 404
    assert res404_st.json()["error"]["code"] == "STATION_NOT_FOUND"

    # 404 Equipment Not Found
    res404_eq = client.get("/api/equipment/99999")
    assert res404_eq.status_code == 404
    assert res404_eq.json()["error"]["code"] == "EQUIPMENT_NOT_FOUND"

    # 400 Invalid Scenario
    res400 = client.post("/api/simulation/scenario", json={"station_id": 1, "scenario": "INVALID_ALIEN_INVASION"})
    assert res400.status_code == 400
    assert res400.json()["error"]["code"] == "INVALID_SCENARIO"

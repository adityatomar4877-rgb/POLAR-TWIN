"""
Tests for the Energy Decision Engine.

Covers:
  TEST 1: Normal station (High battery, High fuel, Generation > demand, No storm) -> NORMAL
  TEST 2: Low battery (Adequate generation, Battery ~25%) -> WARNING / HIGH_RISK
  TEST 3: Energy deficit (Demand > generation, Healthy battery) -> HIGH_RISK / WARNING
  TEST 4: Severe deficit (Severe deficit, Battery critically low <15%, Fuel low <20%) -> CRITICAL
  TEST 5: Storm + low solar + low battery -> Risk escalation
  TEST 6: Grid offline + adequate backup -> WARNING
  TEST 7: Grid offline + insufficient backup -> HIGH_RISK / CRITICAL
  TEST 8: Recommendations correspond to active risk drivers & reasons
  TEST 9: Decision engine performs no physical equipment control / modifies no actuators
  TEST 10: API integration test for GET /api/stations/{station_id}/energy/decision
"""

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.station import Station
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.models.equipment import Equipment
from app.services.energy_decision_service import EnergyDecisionService, EnergyDecisionConfig


# ─────────────────────────────────────────────────────────────
#  Helper to inject specific telemetry state on top of test db
# ─────────────────────────────────────────────────────────────
def _inject_station_state(
    db: Session,
    station_id: int = 1,
    consumption_kw: float = 100.0,
    solar_generation_kw: float = 40.0,
    diesel_generation_kw: float = 120.0,
    battery_percentage: float = 85.0,
    battery_power_kw: float = 10.0,
    fuel_percentage: float = 75.0,
    grid_status: str = "ONLINE",
    wind_speed: float = 30.0,
    visibility: float = 10.0,
    temperature: float = -20.0,
):
    """Adds a new latest EnergyTelemetry and SensorTelemetry record."""
    now = datetime.now(timezone.utc) + timedelta(minutes=1)
    
    sensor = SensorTelemetry(
        station_id=station_id,
        timestamp=now,
        temperature=temperature,
        wind_speed=wind_speed,
        wind_direction=170.0,
        pressure=990.0,
        humidity=65.0,
        precipitation=0.0,
        visibility=visibility,
        source="test_state_injection",
        is_simulated=True,
    )
    db.add(sensor)

    energy = EnergyTelemetry(
        station_id=station_id,
        timestamp=now,
        generation_kw=solar_generation_kw + diesel_generation_kw,
        consumption_kw=consumption_kw,
        energy_balance=(solar_generation_kw + diesel_generation_kw) - consumption_kw,
        battery_percentage=battery_percentage,
        battery_power_kw=battery_power_kw,
        diesel_generation_kw=diesel_generation_kw,
        solar_generation_kw=solar_generation_kw,
        fuel_percentage=fuel_percentage,
        grid_status=grid_status,
        source="test_state_injection",
        is_simulated=True,
    )
    db.add(energy)
    db.commit()


# ─────────────────────────────────────────────────────────────
#  TEST 1: Normal Station
# ─────────────────────────────────────────────────────────────
def test_1_normal_station(db):
    """
    High battery (85%), High fuel (75%), Generation > demand (160 kW vs ~100 kW), No storm.
    Expected: NORMAL status with affirmative reasoning.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=90.0,
        solar_generation_kw=40.0,
        diesel_generation_kw=120.0,  # 160 kW available
        battery_percentage=85.0,
        fuel_percentage=75.0,
        grid_status="ONLINE",
        wind_speed=25.0,
        visibility=10.0,
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.status == "NORMAL"
    assert decision.risk.level == "NORMAL"
    assert decision.energy_state.available_generation_kw == 160.0
    assert decision.energy_margin.h6_kw > 0
    assert "Continue normal energy operations." in decision.recommendations
    assert len(decision.risk.reasons) > 0


# ─────────────────────────────────────────────────────────────
#  TEST 2: Low Battery
# ─────────────────────────────────────────────────────────────
def test_2_low_battery(db):
    """
    Adequate generation, healthy fuel, but battery is low (25% < 30%).
    Expected: WARNING or HIGH_RISK.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=90.0,
        solar_generation_kw=30.0,
        diesel_generation_kw=110.0,  # 140 kW available
        battery_percentage=25.0,     # Low battery
        fuel_percentage=70.0,
        grid_status="ONLINE",
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.status in ("WARNING", "HIGH_RISK")
    assert decision.risk.level in ("WARNING", "HIGH_RISK")
    assert any("battery" in r.lower() for r in decision.risk.reasons)
    assert any("battery" in r.lower() for r in decision.recommendations)


# ─────────────────────────────────────────────────────────────
#  TEST 3: Energy Deficit
# ─────────────────────────────────────────────────────────────
def test_3_energy_deficit(db):
    """
    Demand significantly exceeds available generation (solar 0 kW + diesel 40 kW = 40 kW vs ~100 kW demand).
    Battery is healthy (80%), fuel is healthy (70%).
    Expected: HIGH_RISK or WARNING due to forecast energy deficit.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=100.0,
        solar_generation_kw=0.0,
        diesel_generation_kw=40.0,  # 40 kW available -> deficit
        battery_percentage=80.0,
        fuel_percentage=70.0,
        grid_status="ONLINE",
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.energy_margin.h6_kw < 0
    assert decision.status in ("WARNING", "HIGH_RISK")
    assert any("deficit" in r.lower() or "exceeds" in r.lower() for r in decision.risk.reasons)
    assert any("backup generation" in r.lower() for r in decision.recommendations)


# ─────────────────────────────────────────────────────────────
#  TEST 4: Severe Deficit & Depleted Reserves
# ─────────────────────────────────────────────────────────────
def test_4_severe_deficit_critical(db):
    """
    Demand >> generation (30 kW available vs ~100 kW demand),
    Battery critically low (10% < 15%), Fuel low (12% < 20%).
    Expected: CRITICAL status with urgent recommendations.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=120.0,
        solar_generation_kw=0.0,
        diesel_generation_kw=30.0,  # 30 kW available
        battery_percentage=10.0,    # Critical battery
        fuel_percentage=12.0,       # Low fuel
        grid_status="ONLINE",
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.status == "CRITICAL"
    assert decision.risk.level == "CRITICAL"
    assert len(decision.risk.reasons) >= 2
    assert any("attention" in r.lower() for r in decision.recommendations)
    assert any("battery" in r.lower() for r in decision.recommendations)
    assert any("load" in r.lower() for r in decision.recommendations)


# ─────────────────────────────────────────────────────────────
#  TEST 5: Storm + Low Solar + Low Battery
# ─────────────────────────────────────────────────────────────
def test_5_storm_and_low_reserves(db):
    """
    Severe blizzard (wind 95 km/h, vis 0.5 km) -> storm_flag = True,
    solar generation suppressed to 0 kW, battery at 22%.
    Expected: Risk level escalates to HIGH_RISK or CRITICAL.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=100.0,
        solar_generation_kw=0.0,
        diesel_generation_kw=80.0,
        battery_percentage=22.0,    # Low battery
        fuel_percentage=50.0,
        grid_status="ONLINE",
        wind_speed=95.0,            # Storm
        visibility=0.5,
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.energy_state.storm_flag is True
    assert decision.status in ("HIGH_RISK", "CRITICAL")
    assert any("storm" in r.lower() for r in decision.risk.reasons)
    assert any("weather" in r.lower() or "storm" in r.lower() for r in decision.recommendations)


# ─────────────────────────────────────────────────────────────
#  TEST 6: Grid Offline with Adequate Backup
# ─────────────────────────────────────────────────────────────
def test_6_grid_offline_adequate_backup(db):
    """
    Grid mode is ISLANDED/OFFLINE, but generation (160 kW) is sufficient,
    battery (85%) and fuel (75%) are healthy.
    Expected: WARNING (manageable islanded condition).
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=90.0,
        solar_generation_kw=40.0,
        diesel_generation_kw=120.0,
        battery_percentage=85.0,
        fuel_percentage=75.0,
        grid_status="ISLANDED",
        wind_speed=20.0,
        visibility=10.0,
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.energy_state.grid_status == "ISLANDED"
    assert decision.status == "WARNING"
    assert any("grid" in r.lower() for r in decision.risk.reasons)
    assert any("islanding" in r.lower() or "backup" in r.lower() for r in decision.recommendations)


# ─────────────────────────────────────────────────────────────
#  TEST 7: Grid Offline with Insufficient Backup
# ─────────────────────────────────────────────────────────────
def test_7_grid_offline_insufficient_backup(db):
    """
    Grid is OFFLINE, generation is in deficit (solar 0 kW + diesel 50 kW = 50 kW),
    battery is low (20%).
    Expected: HIGH_RISK or CRITICAL.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=100.0,
        solar_generation_kw=0.0,
        diesel_generation_kw=50.0,
        battery_percentage=20.0,
        fuel_percentage=30.0,
        grid_status="OFFLINE",
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.status in ("HIGH_RISK", "CRITICAL")
    assert any("grid" in r.lower() and "inadequate" in r.lower() for r in decision.risk.reasons)


# ─────────────────────────────────────────────────────────────
#  TEST 8: Verify Recommendations Correspond to Reasons
# ─────────────────────────────────────────────────────────────
def test_8_recommendations_correspond_to_reasons(db):
    """
    Ensure each generated recommendation maps directly to an active risk factor.
    """
    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=110.0,
        solar_generation_kw=5.0,
        diesel_generation_kw=40.0,  # Deficit
        battery_percentage=18.0,    # Low battery
        fuel_percentage=15.0,       # Low fuel
        grid_status="ONLINE",
        wind_speed=80.0,            # Storm
        visibility=1.5,
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    # Risk reasons should capture deficit, battery, fuel, and storm
    reasons_text = " ".join(decision.risk.reasons).lower()
    assert "battery" in reasons_text
    assert "fuel" in reasons_text
    assert "storm" in reasons_text or "renewable" in reasons_text

    recs_text = " ".join(decision.recommendations).lower()
    assert "backup generation" in recs_text
    assert "battery" in recs_text
    assert "fuel" in recs_text
    assert "weather" in recs_text


# ─────────────────────────────────────────────────────────────
#  TEST 9: No Physical Equipment Actuation / Side Effects
# ─────────────────────────────────────────────────────────────
def test_9_no_equipment_control_side_effects(db):
    """
    Ensure the Decision Engine is purely decision-support and does not modify
    any Equipment status, runtime, or operating parameters in the database.
    """
    equipment_before = [
        (e.id, e.status, e.runtime_hours, e.health_score)
        for e in db.query(Equipment).filter(Equipment.station_id == 1).all()
    ]

    _inject_station_state(
        db,
        station_id=1,
        consumption_kw=150.0,
        solar_generation_kw=0.0,
        diesel_generation_kw=20.0,
        battery_percentage=8.0,  # Critical
        fuel_percentage=5.0,     # Critical
        grid_status="OFFLINE",
    )

    station = db.query(Station).filter(Station.id == 1).first()
    service = EnergyDecisionService()
    decision = service.evaluate_station_energy_decision(db, station)

    assert decision.status == "CRITICAL"

    equipment_after = [
        (e.id, e.status, e.runtime_hours, e.health_score)
        for e in db.query(Equipment).filter(Equipment.station_id == 1).all()
    ]

    assert equipment_before == equipment_after, "Equipment state was mutated by decision engine!"


# ─────────────────────────────────────────────────────────────
#  TEST 10: API Integration Test
# ─────────────────────────────────────────────────────────────
def test_10_energy_decision_api_endpoint(client):
    """
    Test GET /api/stations/{station_id}/energy/decision for Maitri and Bharati.
    Validates complete response schema, key names (including 6h_kw, 6h_average_kw),
    and data types.
    """
    for station_code in ("maitri", "bharati"):
        res = client.get(f"/api/stations/{station_code}/energy/decision")
        assert res.status_code == 200, f"Failed for {station_code}: {res.text}"

        data = res.json()
        assert "station_id" in data
        assert data["station_code"] == station_code.upper()
        assert "generated_at" in data
        assert data["status"] in ("NORMAL", "WARNING", "HIGH_RISK", "CRITICAL")

        # Forecast keys
        assert "forecast" in data
        for k in ("6h_average_kw", "12h_average_kw", "24h_average_kw"):
            assert k in data["forecast"], f"Missing forecast key {k}"
            assert isinstance(data["forecast"][k], (int, float))
            assert data["forecast"][k] >= 0.0

        # Energy state keys
        assert "energy_state" in data
        es = data["energy_state"]
        for field in (
            "current_consumption_kw", "solar_generation_kw", "diesel_generation_kw",
            "available_generation_kw", "battery_soc_percent", "battery_power_kw",
            "fuel_level_percent", "grid_status", "storm_flag",
        ):
            assert field in es, f"Missing energy_state field {field}"

        # Energy margin keys
        assert "energy_margin" in data
        for k in ("6h_kw", "12h_kw", "24h_kw"):
            assert k in data["energy_margin"], f"Missing energy_margin key {k}"
            assert isinstance(data["energy_margin"][k], (int, float))

        # Available generation must equal solar + diesel
        assert round(es["available_generation_kw"], 2) == round(es["solar_generation_kw"] + es["diesel_generation_kw"], 2)

        # 6h margin must equal available_generation - 6h_average_kw
        expected_6h_margin = round(es["available_generation_kw"] - data["forecast"]["6h_average_kw"], 2)
        assert abs(data["energy_margin"]["6h_kw"] - expected_6h_margin) < 0.05

        # Risk and recommendations
        assert "risk" in data
        assert data["risk"]["level"] == data["status"]
        assert isinstance(data["risk"]["reasons"], list)
        assert len(data["risk"]["reasons"]) > 0

        assert "recommendations" in data
        assert isinstance(data["recommendations"], list)
        assert len(data["recommendations"]) > 0


def test_energy_decision_nonexistent_station(client):
    """Nonexistent station should return 404."""
    res = client.get("/api/stations/nonexistent/energy/decision")
    assert res.status_code == 404

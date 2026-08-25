import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.energy import EnergyTelemetry
from app.models.equipment import Equipment

client = TestClient(app)


def test_get_operations_status():
    res = client.get("/api/stations/bharati/operations")
    assert res.status_code == 200
    data = res.json()
    assert data["station_code"] == "BHARATI"
    assert "operational_mode" in data
    assert "active_recommendations" in data
    assert "loads" in data


def test_emergency_mode_toggle():
    # Enter emergency mode
    res1 = client.post(
        "/api/stations/bharati/commands/emergency-mode",
        json={"enabled": True, "reason": "Katabatic blizzard alert"},
    )
    assert res1.status_code == 200
    assert res1.json()["new_state"]["operational_mode"] == "EMERGENCY"

    # Exit emergency mode
    res2 = client.post(
        "/api/stations/bharati/commands/emergency-mode",
        json={"enabled": False, "reason": "Weather conditions stabilized"},
    )
    assert res2.status_code == 200
    assert res2.json()["new_state"]["operational_mode"] == "OPERATIONAL"


def test_audit_operations_history():
    res = client.get("/api/stations/bharati/operations/history?limit=10")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) > 0
    assert "action" in logs[0]
    assert "actor" in logs[0]


def test_recommendation_and_execute_flow():
    # 1. Force a power deficit condition
    db = SessionLocal()
    energy = db.query(EnergyTelemetry).filter(EnergyTelemetry.station_id == 2).order_by(EnergyTelemetry.timestamp.desc()).first()
    if energy:
        energy.generation_kw = 20.0
        energy.consumption_kw = 95.0
        energy.energy_balance = -75.0
        energy.battery_power_kw = -75.0
        db.commit()
    g2 = db.query(Equipment).filter(Equipment.station_id == 2, Equipment.name == "Generator 2").first()
    if g2:
        g2.status = "STANDBY"
        db.commit()
    db.close()

    # 2. Get recommendations
    rec_res = client.get("/api/stations/bharati/recommendations")
    assert rec_res.status_code == 200
    recs = rec_res.json()
    assert len(recs) > 0
    gen_rec = next((r for r in recs if r["target_command_type"] == "START_GENERATOR"), recs[0])

    # 3. Execute recommendation
    exec_res = client.post(f"/api/recommendations/{gen_rec['id']}/execute?station_id=bharati")
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["success"] is True
    assert exec_data["status"] == "COMPLETED"

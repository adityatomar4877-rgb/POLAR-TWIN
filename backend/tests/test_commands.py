import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.equipment import Equipment
from app.models.energy import EnergyTelemetry

client = TestClient(app)


def test_command_preview():
    # Preview starting generator 2 on Bharati
    response = client.post(
        "/api/stations/bharati/commands/preview",
        json={"command_type": "START_GENERATOR", "target_id": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["command_type"] == "START_GENERATOR"
    assert data["safe"] is True
    assert "projected_state" in data
    assert "generation_change_kw" in data["impact"]


def test_start_generator_lifecycle():
    # Discover Bharati's Generator 2
    eq_res = client.get("/api/stations/bharati/equipment").json()
    g2 = next(e for e in eq_res if e["name"] == "Generator 2")
    g2_id = g2["id"]

    # 1. Start Generator 2
    response = client.post(
        f"/api/stations/bharati/commands/generators/{g2_id}/start?requested_by=TestOperator&role=OPERATOR"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "COMPLETED"
    assert data["new_state"]["status"] == "ONLINE"

    # 2. Duplicate Start (Idempotent)
    dup_res = client.post(
        f"/api/stations/bharati/commands/generators/{g2_id}/start?requested_by=TestOperator&role=OPERATOR"
    )
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    assert dup_data["success"] is True
    assert "already ONLINE" in dup_data["message"]


def test_safety_interlock_cannot_stop_sole_generator():
    eq_res = client.get("/api/stations/bharati/equipment").json()
    g1 = next(e for e in eq_res if e["name"] == "Generator 1")
    g2 = next(e for e in eq_res if e["name"] == "Generator 2")

    # Stop Generator 1 first (succeeds because Generator 2 was started and is online)
    client.post(
        f"/api/stations/bharati/commands/generators/{g1['id']}/stop?requested_by=TestSupervisor&role=SUPERVISOR"
    )

    # Now Generator 2 is the SOLE active generator. Attempting to stop it MUST trigger 409 UNSAFE_COMMAND!
    res = client.post(
        f"/api/stations/bharati/commands/generators/{g2['id']}/stop?requested_by=TestSupervisor&role=SUPERVISOR"
    )
    assert res.status_code == 409
    data = res.json()
    assert data["error"]["code"] == "UNSAFE_COMMAND"


def test_safety_interlock_failed_generator_lockout():
    db = SessionLocal()
    g1 = db.query(Equipment).filter(Equipment.station_id == 2, Equipment.name == "Generator 1").first()
    if g1:
        g1.status = "OFFLINE"
        g1.health_score = 20.0
        db.commit()
    g1_id = g1.id if g1 else 8
    db.close()

    # Attempt to start failed generator without maintenance clearing
    res = client.post(
        f"/api/stations/bharati/commands/generators/{g1_id}/start?requested_by=TestOperator&role=OPERATOR"
    )
    assert res.status_code == 409
    data = res.json()
    assert data["error"]["code"] == "EQUIPMENT_FAULT_LOCKOUT"

    # Restore g1 for other tests
    db = SessionLocal()
    g1 = db.query(Equipment).filter(Equipment.station_id == 2, Equipment.name == "Generator 1").first()
    if g1:
        g1.status = "NORMAL"
        g1.health_score = 92.0
        db.commit()
    db.close()


def test_equipment_shutdown_and_restart():
    # Restart HVAC System on Bharati
    eq_res = client.get("/api/stations/bharati/equipment").json()
    hvac = next(e for e in eq_res if e["name"] == "HVAC System")

    res = client.post(
        f"/api/stations/bharati/commands/equipment/{hvac['id']}/restart?requested_by=TestOperator&role=OPERATOR"
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["new_state"]["status"] == "NORMAL"

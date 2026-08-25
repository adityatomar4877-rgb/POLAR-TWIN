import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.audit import LoadGroup
from app.models.energy import EnergyTelemetry

client = TestClient(app)


def test_get_station_loads():
    res = client.get("/api/stations/bharati/loads")
    assert res.status_code == 200
    loads = res.json()
    assert len(loads) >= 9
    assert any(l["category"] == "CRITICAL" for l in loads)
    assert any(l["category"] == "NON_CRITICAL" for l in loads)


def test_load_shedding_non_critical():
    # Ensure loads are restored first so non-critical loads are enabled
    client.post(
        "/api/stations/bharati/commands/load-restore",
        json={"load_group": "ALL", "reason": "Pre-test restoration"},
    )
    # Record current energy before shed
    e_before = client.get("/api/stations/bharati/energy/current").json()
    
    # Shed non-critical loads
    res = client.post(
        "/api/stations/bharati/commands/load-shed",
        json={"load_group": "NON_CRITICAL", "reason": "Energy deficit mitigation"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "shed_groups" in data["new_state"]
    assert data["system_impact"]["consumption_reduction_kw"] > 0


def test_safety_interlock_cannot_shed_critical_load():
    loads_res = client.get("/api/stations/bharati/loads").json()
    crit_load = next(l for l in loads_res if l["category"] == "CRITICAL")

    res = client.post(
        "/api/stations/bharati/commands/load-shed",
        json={"load_group": str(crit_load["id"]), "reason": "Accidental critical shed attempt"},
    )
    assert res.status_code == 409
    data = res.json()
    assert data["error"]["code"] == "CRITICAL_LOAD_PROTECTED"


def test_load_restoration():
    res = client.post(
        "/api/stations/bharati/commands/load-restore",
        json={"load_group": "ALL", "reason": "Restoring microgrid loads"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "restored_groups" in data["new_state"]

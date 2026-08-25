import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.equipment import Equipment

client = TestClient(app)


def test_maintenance_task_lifecycle():
    # 1. Get initial maintenance tasks
    res = client.get("/api/stations/bharati/maintenance")
    assert res.status_code == 200
    tasks = res.json()
    assert isinstance(tasks, list)

    # Discover Bharati equipment
    eq_res = client.get("/api/stations/bharati/equipment").json()
    gen1 = next(e for e in eq_res if e["name"] == "Generator 1")

    # 2. Create new maintenance task
    create_res = client.post(
        "/api/stations/bharati/maintenance",
        json={
            "equipment_id": gen1["id"],
            "title": "Generator 1 Oil Filter & Valve Inspection",
            "description": "Routine 250-hour mechanical inspection.",
            "priority": "HIGH",
            "recommended_by": "AnomalyEngine",
        },
    )
    assert create_res.status_code == 200
    task_data = create_res.json()
    assert task_data["title"] == "Generator 1 Oil Filter & Valve Inspection"
    assert task_data["status"] == "OPEN"

    # 3. Complete maintenance task
    task_id = task_data["id"]
    comp_res = client.patch(f"/api/maintenance/{task_id}/complete?completed_by=TestEngineer")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["status"] == "COMPLETED"
    assert comp_data["completed_at"] is not None


def test_resupply_request_lifecycle():
    # 1. Get resupply requests
    res = client.get("/api/stations/bharati/logistics/resupply")
    assert res.status_code == 200
    reqs = res.json()
    assert isinstance(reqs, list)

    # 2. Create new resupply request
    create_res = client.post(
        "/api/stations/bharati/logistics/resupply",
        json={
            "item": "FUEL",
            "quantity": 18000.0,
            "unit": "liters",
            "priority": "CRITICAL",
            "reason": "Mid-season reserve top-up before winter traverse window closes.",
            "requested_by": "Station Commander",
        },
    )
    assert create_res.status_code == 200
    res_data = create_res.json()
    assert res_data["item"] == "FUEL"
    assert res_data["quantity"] == 18000.0
    assert res_data["status"] == "REQUESTED"

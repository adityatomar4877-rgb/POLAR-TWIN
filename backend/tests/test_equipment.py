def test_get_station_equipment(client):
    response = client.get("/api/stations/maitri/equipment")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 7
    names = [eq["name"] for eq in data]
    assert "Generator 1" in names
    assert "Battery Bank" in names
    assert "HVAC System" in names


def test_get_equipment_detail(client):
    response = client.get("/api/equipment/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert "name" in data
    assert 0 <= data["health_score"] <= 100


def test_get_equipment_health_diagnostics(client):
    response = client.get("/api/equipment/1/health")
    assert response.status_code == 200
    data = response.json()
    assert "health_score" in data
    assert "status" in data
    assert "contributing_factors" in data
    assert "recommendation" in data
    assert isinstance(data["contributing_factors"], list)


def test_equipment_not_found(client):
    response = client.get("/api/equipment/99999")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "EQUIPMENT_NOT_FOUND"

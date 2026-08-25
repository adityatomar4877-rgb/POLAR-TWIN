def test_get_all_stations(client):
    response = client.get("/api/stations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    codes = [s["code"] for s in data]
    assert "MAITRI" in codes
    assert "BHARATI" in codes


def test_get_station_by_id(client):
    response = client.get("/api/stations/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["code"] == "MAITRI"


def test_get_station_by_code(client):
    response = client.get("/api/stations/bharati")
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "BHARATI"
    assert "Larsemann" in data["description"] or "Bharati" in data["name"]


def test_station_not_found(client):
    response = client.get("/api/stations/non_existent_station")
    assert response.status_code == 404
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "STATION_NOT_FOUND"

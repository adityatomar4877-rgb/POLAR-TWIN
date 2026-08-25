def test_get_current_environment(client):
    response = client.get("/api/stations/maitri/environment/current")
    assert response.status_code == 200
    data = response.json()
    assert "temperature" in data
    assert "wind_speed" in data
    assert "pressure" in data
    assert "source" in data
    assert "is_simulated" in data
    assert isinstance(data["is_simulated"], bool)


def test_get_environment_history(client):
    response = client.get("/api/stations/maitri/environment/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["station_id"] == 1
    assert data["count"] == 10
    assert len(data["data"]) == 10

def test_get_current_energy(client):
    response = client.get("/api/stations/bharati/energy/current")
    assert response.status_code == 200
    data = response.json()
    assert data["generation_kw"] >= 0
    assert data["consumption_kw"] >= 0
    assert 0 <= data["battery_percentage"] <= 100
    assert 0 <= data["fuel_percentage"] <= 100
    # Energy balance equality
    expected_balance = round(data["generation_kw"] - data["consumption_kw"], 2)
    assert abs(data["energy_balance"] - expected_balance) < 0.01


def test_get_energy_history(client):
    response = client.get("/api/stations/bharati/energy/history?limit=15")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 15
    assert len(data["data"]) == 15


def test_get_energy_forecast(client):
    response = client.get("/api/stations/bharati/energy/forecast?horizon_hours=12")
    assert response.status_code == 200
    data = response.json()
    assert data["horizon_hours"] == 12
    assert len(data["forecast"]) == 12
    assert "model_name" in data
    assert data["forecast"][0]["predicted_consumption_kw"] > 0

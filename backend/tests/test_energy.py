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
    response = client.get("/api/stations/bharati/energy/forecast")
    assert response.status_code == 200
    data = response.json()
    assert data["model_name"] == "RandomForestEnergyForecast"
    assert data["is_fallback"] is False
    assert data["feature_count"] == 63
    assert "forecast" in data
    assert "6h" in data["forecast"]
    assert "12h" in data["forecast"]
    assert "24h" in data["forecast"]
    assert data["forecast"]["6h"]["average_consumption_kw"] >= 0


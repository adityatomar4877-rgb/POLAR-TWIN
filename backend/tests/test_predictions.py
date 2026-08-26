def test_get_predictions_summary(client):
    response = client.get("/api/stations/maitri/predictions")
    assert response.status_code == 200
    data = response.json()
    assert "energy_forecast" in data
    assert data["energy_forecast"]["model_name"] == "RandomForestEnergyForecast"
    assert data["energy_forecast"]["is_fallback"] is False
    assert "fuel_depletion_forecast" in data
    assert data["fuel_depletion_forecast"]["current_fuel_percentage"] > 0


def test_get_energy_prediction_endpoint(client):
    response = client.get("/api/stations/bharati/predictions/energy")
    assert response.status_code == 200
    data = response.json()
    assert data["model_name"] == "RandomForestEnergyForecast"
    assert data["is_fallback"] is False
    assert data["feature_count"] == 63
    assert "6h" in data["forecast"]
    assert "12h" in data["forecast"]
    assert "24h" in data["forecast"]
    assert data["forecast"]["6h"]["average_consumption_kw"] >= 0



def test_get_fuel_prediction_endpoint(client):
    response = client.get("/api/stations/bharati/predictions/fuel")
    assert response.status_code == 200
    data = response.json()
    assert "days_until_critical" in data
    assert "critical_threshold_percentage" in data
    assert "recommended_resupply" in data
    assert "advisory_notes" in data

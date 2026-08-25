def test_get_predictions_summary(client):
    response = client.get("/api/stations/maitri/predictions")
    assert response.status_code == 200
    data = response.json()
    assert "energy_forecast_24h" in data
    assert "fuel_depletion_forecast" in data
    assert data["energy_forecast_24h"]["horizon_hours"] == 24
    assert data["fuel_depletion_forecast"]["current_fuel_percentage"] > 0


def test_get_energy_prediction_endpoint(client):
    response = client.get("/api/stations/bharati/predictions/energy?horizon_hours=6")
    assert response.status_code == 200
    data = response.json()
    assert data["horizon_hours"] == 6
    assert len(data["forecast"]) == 6
    assert data["average_predicted_consumption_kw"] > 0


def test_get_fuel_prediction_endpoint(client):
    response = client.get("/api/stations/bharati/predictions/fuel")
    assert response.status_code == 200
    data = response.json()
    assert "days_until_critical" in data
    assert "critical_threshold_percentage" in data
    assert "recommended_resupply" in data
    assert "advisory_notes" in data

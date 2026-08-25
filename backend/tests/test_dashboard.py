def test_get_station_dashboard_summary(client):
    response = client.get("/api/stations/maitri/dashboard")
    assert response.status_code == 200
    data = response.json()

    # Verify all 8 core objects are present in the unified dashboard payload
    assert "station" in data
    assert data["station"]["code"] == "MAITRI"

    assert "environment" in data
    assert data["environment"]["temperature"] is not None

    assert "energy" in data
    assert data["energy"]["generation_kw"] is not None

    assert "equipment" in data
    assert len(data["equipment"]) == 7

    assert "logistics" in data
    assert len(data["logistics"]) >= 2

    assert "alerts" in data
    assert isinstance(data["alerts"], list)

    assert "predictions" in data
    assert "energy_forecast_24h" in data["predictions"]
    assert "fuel_forecast" in data["predictions"]

    assert "simulation" in data
    assert "active_scenario" in data["simulation"]
    assert data["simulation"]["active_scenario"] == "NORMAL_OPERATION"

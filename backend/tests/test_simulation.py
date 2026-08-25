def test_get_simulation_status(client):
    response = client.get("/api/simulation/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "interval_seconds" in data
    assert "active_scenarios" in data


def test_simulation_start_and_stop(client):
    stop_resp = client.post("/api/simulation/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json()["is_running"] is False

    start_resp = client.post("/api/simulation/start")
    assert start_resp.status_code == 200
    assert start_resp.json()["is_running"] is True


def test_trigger_generator_failure_scenario(client):
    payload = {
        "station_id": "bharati",
        "scenario": "GENERATOR_FAILURE",
        "duration_minutes": 45,
        "apply_to_live": True,
    }
    response = client.post("/api/simulation/scenario", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "GENERATOR_FAILURE"
    assert data["station_code"] == "BHARATI"
    assert "energy_deficit_kw" in data["impact"]
    assert len(data["affected_systems"]) > 0
    assert len(data["recommendations"]) > 0
    assert data["applied_to_simulation"] is True


def test_trigger_extreme_cold_scenario(client):
    payload = {
        "station_id": "maitri",
        "scenario": "EXTREME_COLD",
        "duration_minutes": 30,
        "apply_to_live": True,
    }
    response = client.post("/api/simulation/scenario", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["scenario"] == "EXTREME_COLD"
    assert "temperature_drop_celsius" in data["impact"]
    assert "HVAC Heating & Ventilation" in data["affected_systems"]


def test_trigger_invalid_scenario(client):
    payload = {
        "station_id": "maitri",
        "scenario": "ALIEN_INVASION",
    }
    response = client.post("/api/simulation/scenario", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "INVALID_SCENARIO"


def test_reset_simulation(client):
    response = client.post("/api/simulation/reset")
    assert response.status_code == 200
    assert response.json()["success"] is True

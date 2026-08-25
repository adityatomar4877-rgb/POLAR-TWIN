def test_get_station_alerts(client):
    response = client.get("/api/stations/maitri/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["station_id"] == 1


def test_get_active_alerts(client):
    response = client.get("/api/alerts/active")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["acknowledged"] is False


def test_acknowledge_alert(client):
    active_resp = client.get("/api/alerts/active")
    alert_id = active_resp.json()[0]["id"]

    patch_resp = client.patch(f"/api/alerts/{alert_id}/acknowledge")
    assert patch_resp.status_code == 200
    data = patch_resp.json()
    assert data["id"] == alert_id
    assert data["acknowledged"] is True


def test_acknowledge_invalid_alert(client):
    patch_resp = client.patch("/api/alerts/99999/acknowledge")
    assert patch_resp.status_code == 404
    data = patch_resp.json()
    assert data["success"] is False
    assert data["error"]["code"] == "ALERT_NOT_FOUND"

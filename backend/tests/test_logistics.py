def test_get_station_logistics(client):
    response = client.get("/api/stations/maitri/logistics")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    fuel_item = next(it for it in data if it["category"] == "FUEL")
    assert fuel_item["days_remaining"] == round(fuel_item["quantity"] / fuel_item["daily_consumption"], 1)


def test_get_logistics_forecast(client):
    response = client.get("/api/stations/maitri/logistics/forecast")
    assert response.status_code == 200
    data = response.json()
    assert "critical_items_count" in data
    assert "warning_items_count" in data
    assert "items" in data
    assert "resupply_recommendations" in data
    assert isinstance(data["resupply_recommendations"], list)

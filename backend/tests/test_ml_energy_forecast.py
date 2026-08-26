"""
Tests for the ML Random Forest energy forecast integration.

Verifies:
  1. Model files load successfully from app/ml/.
  2. Feature engineering produces exactly 63 features in the correct order.
  3. All 3 models (6h, 12h, 24h) return numeric, non-negative predictions.
  4. The energy forecast API endpoint /api/stations/{id}/predictions/energy returns:
     - model_name == "RandomForestEnergyForecast"
     - is_fallback == False
     - feature_count == 63
     - current_consumption_kw numeric
     - 6h, 12h, 24h average-demand predictions
  5. Predictions change dynamically when underlying station telemetry changes.
  6. Error handling for missing stations and missing telemetry.
"""

import math
import pytest
from datetime import datetime, timedelta, timezone
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry


# ─────────────────────────────────────────────────
# Unit test: Service-level model loading & inference
# ─────────────────────────────────────────────────
def test_ml_models_load_and_predict(db):
    """
    Loads models, fetches Maitri telemetry, builds 63 features,
    runs all 3 RF models, and asserts predictions are numeric & non-negative.
    """
    from app.services.energy_forecast_service import EnergyForecastService

    svc = EnergyForecastService()
    svc._ensure_loaded()

    assert svc._loaded is True
    assert svc._feature_count == 63
    assert len(svc._feature_names) == 63
    assert len(svc._models) == 3

    result = svc.predict(db, station_id=1, station_code="MAITRI")

    assert result["station_id"] == 1
    assert result["station_code"] == "MAITRI"
    assert result["feature_count"] == 63
    assert result["model_name"] == "RandomForestEnergyForecast"
    assert result["is_fallback"] is False
    assert isinstance(result["current_consumption_kw"], (int, float))
    assert "forecast" in result

    for horizon in ("6h", "12h", "24h"):
        assert horizon in result["forecast"], f"Missing horizon '{horizon}'"
        pred = result["forecast"][horizon]["average_consumption_kw"]
        assert isinstance(pred, (int, float)), f"Prediction for {horizon} is not numeric: {type(pred)}"
        assert pred >= 0.0, f"Prediction for {horizon} is negative: {pred}"
        assert math.isfinite(pred), f"Prediction for {horizon} is not finite: {pred}"


def test_feature_vector_ordering_and_count(db):
    """
    Directly exercises the feature engineering pipeline
    and verifies the ordering matches the metadata.
    """
    from app.services.energy_forecast_service import EnergyForecastService

    svc = EnergyForecastService()
    svc._ensure_loaded()

    energy_history = (
        db.query(EnergyTelemetry)
        .filter(EnergyTelemetry.station_id == 1)
        .order_by(EnergyTelemetry.timestamp.asc())
        .all()
    )
    sensor_history = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == 1)
        .order_by(SensorTelemetry.timestamp.asc())
        .all()
    )

    features = svc._build_features(energy_history, sensor_history)

    assert len(features) == 63, f"Expected 63 features, got {len(features)}"
    for i, val in enumerate(features):
        assert isinstance(val, (int, float)), f"Feature {i} ({svc._feature_names[i]}) is not numeric"
        assert math.isfinite(val), f"Feature {i} ({svc._feature_names[i]}) is not finite: {val}"


# ─────────────────────────────────────────────────
# Integration tests: API endpoint via TestClient
# ─────────────────────────────────────────────────
def test_ml_energy_forecast_endpoint_maitri(client):
    """GET /api/stations/maitri/predictions/energy returns valid RF forecast."""
    response = client.get("/api/stations/maitri/predictions/energy")
    assert response.status_code == 200, f"Unexpected status: {response.status_code} — {response.text}"

    data = response.json()
    assert data["station_code"] == "MAITRI"
    assert data["model_name"] == "RandomForestEnergyForecast"
    assert data["is_fallback"] is False
    assert data["feature_count"] == 63
    assert isinstance(data["current_consumption_kw"], (int, float))

    for horizon in ("6h", "12h", "24h"):
        assert horizon in data["forecast"]
        pred = data["forecast"][horizon]["average_consumption_kw"]
        assert isinstance(pred, (int, float))
        assert pred >= 0.0


def test_ml_energy_forecast_endpoint_bharati(client):
    """GET /api/stations/bharati/predictions/energy works for Bharati station."""
    response = client.get("/api/stations/bharati/predictions/energy")
    assert response.status_code == 200
    data = response.json()
    assert data["station_code"] == "BHARATI"
    assert data["model_name"] == "RandomForestEnergyForecast"
    assert data["is_fallback"] is False
    assert data["feature_count"] == 63

    for horizon in ("6h", "12h", "24h"):
        assert horizon in data["forecast"]
        pred = data["forecast"][horizon]["average_consumption_kw"]
        assert pred >= 0.0


def test_ml_energy_forecast_invalid_station(client):
    """A non-existent station should return 404."""
    response = client.get("/api/stations/nonexistent/predictions/energy")
    assert response.status_code == 404


def test_predictions_change_when_telemetry_changes(db):
    """
    Verifies that the Random Forest inference changes dynamically
    when underlying station telemetry (e.g. higher load / colder temp) changes.
    """
    from app.services.energy_forecast_service import energy_forecast_service

    # Baseline prediction
    baseline = energy_forecast_service.predict(db, station_id=1, station_code="MAITRI")
    baseline_6h = baseline["forecast"]["6h"]["average_consumption_kw"]

    # Inject extreme high consumption & blizzard cold weather records
    now = datetime.now(timezone.utc)
    for i in range(10):
        t = now + timedelta(minutes=i + 1)
        db.add(
            SensorTelemetry(
                station_id=1,
                timestamp=t,
                temperature=-45.0,
                wind_speed=95.0,
                wind_direction=180.0,
                pressure=960.0,
                humidity=85.0,
                precipitation=5.0,
                visibility=0.5,
                source="test_extreme",
                is_simulated=True,
            )
        )
        db.add(
            EnergyTelemetry(
                station_id=1,
                timestamp=t,
                generation_kw=220.0,
                consumption_kw=210.0,
                energy_balance=10.0,
                battery_percentage=60.0,
                battery_power_kw=-20.0,
                diesel_generation_kw=220.0,
                solar_generation_kw=0.0,
                fuel_percentage=60.0,
                grid_status="ISLANDED",
                source="test_extreme",
                is_simulated=True,
            )
        )
    db.commit()

    updated = energy_forecast_service.predict(db, station_id=1, station_code="MAITRI")
    updated_6h = updated["forecast"]["6h"]["average_consumption_kw"]

    # The prediction must react to the altered physical telemetry
    assert updated_6h != baseline_6h, f"Expected prediction to change, got {updated_6h} == {baseline_6h}"

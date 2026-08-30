import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_get_copilot_status():
    response = client.get("/api/copilot/status")
    assert response.status_code == 200
    data = response.json()
    assert "active_provider" in data
    assert "configured_model" in data
    assert "ollama_available" in data
    assert "fallback_active" in data


def test_copilot_assess_risk():
    response = client.post("/api/stations/bharati/copilot/assess-risk")
    assert response.status_code == 200
    data = response.json()
    assert "overall_score" in data
    assert "risk_level" in data
    assert "summary" in data
    assert "energy_risk" in data
    assert "weather_risk" in data
    assert "equipment_risk" in data
    assert "logistics_risk" in data
    assert isinstance(data["overall_score"], (int, float))
    assert data["risk_level"] in ["NOMINAL", "GUARDED", "ELEVATED", "HIGH", "CRITICAL"]


def test_copilot_diagnose():
    response = client.post("/api/stations/bharati/copilot/diagnose")
    assert response.status_code == 200
    data = response.json()
    assert "diagnostic_summary" in data
    assert "subsystems_status" in data
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)


def test_copilot_chat():
    payload = {
        "message": "Evaluate outdoor safety and blizzard risk",
        "station_id": "bharati",
    }
    response = client.post("/api/stations/bharati/copilot/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "risk_level" in data
    assert "model_used" in data
    assert len(data["answer"]) > 10

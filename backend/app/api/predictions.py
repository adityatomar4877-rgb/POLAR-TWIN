from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.prediction import (
    EnergyForecastResponse,
    FuelDepletionForecastResponse,
    PredictionSummaryOut,
)
from app.services.station_service import station_service
from app.services.prediction_service import prediction_service
from app.services.energy_forecast_service import energy_forecast_service

router = APIRouter(prefix="/stations/{station_id}/predictions", tags=["Predictions & Forecasting"])


@router.get("", response_model=PredictionSummaryOut)
def get_prediction_summary(station_id: str, db: Session = Depends(get_db)):
    """Retrieves combined Random Forest energy forecast and fuel depletion predictions."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    energy_fc = energy_forecast_service.predict(db, station.id, station.code)
    fuel_fc = prediction_service.forecast_fuel_depletion(db, station.id, station.code)
    return PredictionSummaryOut(
        station_id=station.id,
        energy_forecast=energy_fc,
        energy_forecast_24h=energy_fc,
        fuel_depletion_forecast=fuel_fc,
    )


@router.get("/energy", response_model=EnergyForecastResponse)
def get_energy_prediction(station_id: str, db: Session = Depends(get_db)):
    """
    Random Forest energy consumption forecast (6h / 12h / 24h average demand).

    Uses pre-trained RandomForestRegressor models with 63 engineered features
    derived from the station's latest energy and sensor telemetry history.
    Models are read-only and never retrained via the API.
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    return energy_forecast_service.predict(db, station.id, station.code)


@router.get("/fuel", response_model=FuelDepletionForecastResponse)
def get_fuel_prediction(station_id: str, db: Session = Depends(get_db)):
    """Predicts fuel reserve depletion trajectories and threshold advisory."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return prediction_service.forecast_fuel_depletion(db, station.id, station.code)

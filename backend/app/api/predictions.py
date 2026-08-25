from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.prediction import (
    EnergyForecastResponse,
    FuelDepletionForecastResponse,
    PredictionSummaryOut,
)
from app.services.station_service import station_service
from app.services.prediction_service import prediction_service

router = APIRouter(prefix="/stations/{station_id}/predictions", tags=["Predictions & Forecasting"])


@router.get("", response_model=PredictionSummaryOut)
def get_prediction_summary(station_id: str, db: Session = Depends(get_db)):
    """Retrieves combined energy forecast and fuel critical depletion predictions."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    energy_fc = prediction_service.forecast_energy(db, station.id, station.code, horizon_hours=24)
    fuel_fc = prediction_service.forecast_fuel_depletion(db, station.id, station.code)
    return PredictionSummaryOut(
        station_id=station.id,
        energy_forecast_24h=energy_fc,
        fuel_depletion_forecast=fuel_fc,
    )


@router.get("/energy", response_model=EnergyForecastResponse)
def get_energy_prediction(
    station_id: str,
    horizon_hours: int = Query(default=24, ge=1, le=72),
    db: Session = Depends(get_db),
):
    """Retrieves ML-backed energy consumption forecast with confidence intervals."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return prediction_service.forecast_energy(db, station.id, station.code, horizon_hours=horizon_hours)


@router.get("/fuel", response_model=FuelDepletionForecastResponse)
def get_fuel_prediction(station_id: str, db: Session = Depends(get_db)):
    """Predicts fuel reserve depletion trajectories and threshold advisory."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return prediction_service.forecast_fuel_depletion(db, station.id, station.code)

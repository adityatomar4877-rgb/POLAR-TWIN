from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.energy import EnergyTelemetryOut, HistoricalEnergyOut
from app.schemas.prediction import EnergyForecastResponse
from app.services.station_service import station_service
from app.services.energy_service import energy_service
from app.services.energy_forecast_service import energy_forecast_service
from app.core.security import APIError

router = APIRouter(prefix="/stations/{station_id}/energy", tags=["Energy Telemetry"])


@router.get("/current", response_model=EnergyTelemetryOut)
def get_current_energy(station_id: str, db: Session = Depends(get_db)):
    """Retrieves current live microgrid power generation, consumption, battery SoC, and grid status."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    latest = energy_service.get_current_energy(db, station.id)
    if not latest:
        raise APIError(
            code="NO_ENERGY_DATA",
            message=f"No energy telemetry recorded yet for station '{station.name}'.",
            status_code=404,
        )
    return latest


@router.get("/history", response_model=HistoricalEnergyOut)
def get_energy_history(
    station_id: str,
    limit: int = Query(default=168, ge=1, le=720, description="Max historical hourly records to return"),
    db: Session = Depends(get_db),
):
    """Retrieves historical energy generation, consumption, and balance records for trend analysis."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    records = energy_service.get_energy_history(db, station.id, limit=limit)
    return HistoricalEnergyOut(
        station_id=station.id,
        count=len(records),
        data=[EnergyTelemetryOut.model_validate(r) for r in records],
    )


@router.get("/forecast", response_model=EnergyForecastResponse)
def get_energy_forecast(
    station_id: str,
    db: Session = Depends(get_db),
):
    """Generates Random Forest energy demand forecast (6h / 12h / 24h average demand)."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return energy_forecast_service.predict(db, station.id, station.code)


from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.sensor import HistoricalEnvironmentOut, SensorTelemetryOut
from app.services.station_service import station_service
from app.models.sensor import SensorTelemetry
from app.core.security import APIError

router = APIRouter(prefix="/stations/{station_id}/environment", tags=["Environment Telemetry"])


@router.get("/current", response_model=SensorTelemetryOut)
def get_current_environment(station_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the most recent environmental telemetry for a station.
    Includes data provenance (e.g. source, is_simulated).
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    latest = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == station.id)
        .order_by(SensorTelemetry.timestamp.desc())
        .first()
    )
    if not latest:
        raise APIError(
            code="NO_ENVIRONMENT_DATA",
            message=f"No environmental telemetry recorded yet for station '{station.name}'.",
            status_code=404,
        )
    return latest


@router.get("/history", response_model=HistoricalEnvironmentOut)
def get_environment_history(
    station_id: str,
    limit: int = Query(default=168, ge=1, le=720, description="Max number of historical records (default 168 = 7 days)"),
    db: Session = Depends(get_db),
):
    """Retrieves chronological historical environmental telemetry for time-series charts and analysis."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    records = (
        db.query(SensorTelemetry)
        .filter(SensorTelemetry.station_id == station.id)
        .order_by(SensorTelemetry.timestamp.desc())
        .limit(limit)
        .all()
    )
    chronological = list(reversed(records))
    return HistoricalEnvironmentOut(
        station_id=station.id,
        count=len(chronological),
        data=[SensorTelemetryOut.model_validate(r) for r in chronological],
    )

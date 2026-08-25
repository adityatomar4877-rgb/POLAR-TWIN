from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.alert import AlertOut
from app.services.station_service import station_service
from app.services.alert_service import alert_service
from app.core.security import APIError

router = APIRouter(tags=["Alerts & Anomalies"])


@router.get("/stations/{station_id}/alerts", response_model=List[AlertOut])
def get_station_alerts(
    station_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieves recent alerts and events generated for a specific station."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return alert_service.get_alerts_by_station(db, station.id, limit=limit)


@router.get("/alerts/active", response_model=List[AlertOut])
def get_active_unacknowledged_alerts(
    station_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Retrieves all active unacknowledged warnings and critical alerts across all or selected stations."""
    st_id = None
    if station_id:
        station = station_service.get_station_by_id_or_code(db, station_id)
        st_id = station.id
    return alert_service.get_active_alerts(db, station_id=st_id)


@router.patch("/alerts/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    """Acknowledges an active alert, updating its status."""
    alert = alert_service.acknowledge_alert(db, alert_id)
    if not alert:
        raise APIError(
            code="ALERT_NOT_FOUND",
            message=f"Alert with ID #{alert_id} not found.",
            status_code=404,
        )
    return alert

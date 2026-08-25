from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.logistics import LogisticsForecastOut, LogisticsItemOut
from app.services.station_service import station_service
from app.services.logistics_service import logistics_service

router = APIRouter(prefix="/stations/{station_id}/logistics", tags=["Logistics & Supplies"])


@router.get("", response_model=List[LogisticsItemOut])
def get_station_logistics(station_id: str, db: Session = Depends(get_db)):
    """Retrieves all tracked consumable inventory items, daily burn rates, and days remaining."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return logistics_service.get_items_by_station(db, station.id)


@router.get("/forecast", response_model=LogisticsForecastOut)
def get_logistics_forecast(station_id: str, db: Session = Depends(get_db)):
    """Calculates critical and warning shortages, resupply prioritization, and logistics forecasts."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return logistics_service.get_logistics_forecast(db, station.id)

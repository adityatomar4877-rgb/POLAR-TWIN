from typing import List, Union
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.station import StationOut
from app.services.station_service import station_service

router = APIRouter(prefix="/stations", tags=["Stations"])


@router.get("", response_model=List[StationOut])
def get_all_stations(db: Session = Depends(get_db)):
    """Retrieves all registered Antarctic research stations (Maitri, Bharati)."""
    return station_service.get_all_stations(db)


@router.get("/{station_id}", response_model=StationOut)
def get_station(station_id: str, db: Session = Depends(get_db)):
    """Retrieves details of a specific station by its database ID or station code ('MAITRI' / 'BHARATI')."""
    return station_service.get_station_by_id_or_code(db, station_id)

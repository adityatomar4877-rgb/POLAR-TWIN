import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.maintenance import (
    MaintenanceTaskCreate,
    MaintenanceTaskOut,
    ResupplyRequestCreate,
    ResupplyRequestOut,
)
from app.services.station_service import station_service
from app.services.maintenance_service import maintenance_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Maintenance & Logistics Management"])


@router.get("/stations/{station_id}/maintenance", response_model=List[MaintenanceTaskOut])
def get_station_maintenance_tasks(
    station_id: str,
    status: Optional[str] = Query(None, description="Filter by status: OPEN, SCHEDULED, IN_PROGRESS, COMPLETED"),
    db: Session = Depends(get_db),
):
    """Retrieves maintenance tasks for a research station."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return maintenance_service.get_maintenance_tasks(db, station.id, status)


@router.post("/stations/{station_id}/maintenance", response_model=MaintenanceTaskOut)
def create_station_maintenance_task(
    station_id: str,
    task_in: MaintenanceTaskCreate,
    db: Session = Depends(get_db),
):
    """Creates a new maintenance task for station equipment."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return maintenance_service.create_maintenance_task(db, station.id, task_in)


@router.patch("/maintenance/{task_id}/complete", response_model=MaintenanceTaskOut)
def complete_maintenance_task(
    task_id: int,
    completed_by: str = Query("Operator_Demo"),
    db: Session = Depends(get_db),
):
    """Marks a maintenance task as completed and clears associated equipment failure lockout."""
    return maintenance_service.complete_maintenance_task(db, task_id, completed_by)


@router.get("/stations/{station_id}/logistics/resupply", response_model=List[ResupplyRequestOut])
def get_station_resupply_requests(
    station_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves logistics resupply requests for a station."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return maintenance_service.get_resupply_requests(db, station.id)


@router.post("/stations/{station_id}/logistics/resupply", response_model=ResupplyRequestOut)
def create_station_resupply_request(
    station_id: str,
    req_in: ResupplyRequestCreate,
    db: Session = Depends(get_db),
):
    """Creates a formal logistics resupply request for fuel, rations, or spare parts."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return maintenance_service.create_resupply_request(db, station.id, req_in)

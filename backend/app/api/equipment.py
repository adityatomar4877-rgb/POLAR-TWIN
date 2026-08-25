from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.equipment import EquipmentHealthOut, EquipmentOut
from app.services.station_service import station_service
from app.models.equipment import Equipment
from app.utils.calculations import calculate_equipment_health
from app.core.security import APIError

router = APIRouter(tags=["Equipment & Subsystems"])


@router.get("/stations/{station_id}/equipment", response_model=List[EquipmentOut])
def get_station_equipment(station_id: str, db: Session = Depends(get_db)):
    """Retrieves all registered equipment and vital subsystems for a station."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return db.query(Equipment).filter(Equipment.station_id == station.id).all()


@router.get("/equipment/{equipment_id}", response_model=EquipmentOut)
def get_equipment_detail(equipment_id: int, db: Session = Depends(get_db)):
    """Retrieves single equipment asset telemetry and status."""
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise APIError(
            code="EQUIPMENT_NOT_FOUND",
            message=f"Equipment asset with ID #{equipment_id} not found.",
            status_code=404,
        )
    return eq


@router.get("/equipment/{equipment_id}/health", response_model=EquipmentHealthOut)
def get_equipment_health(equipment_id: int, db: Session = Depends(get_db)):
    """Provides a deterministic health score, diagnostics, contributing factors, and operational recommendations."""
    eq = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not eq:
        raise APIError(
            code="EQUIPMENT_NOT_FOUND",
            message=f"Equipment asset with ID #{equipment_id} not found.",
            status_code=404,
        )

    nominal_temp = 70.0 if eq.equipment_type == "GENERATOR" else (40.0 if eq.equipment_type == "HVAC" else 25.0)
    health_res = calculate_equipment_health(
        name=eq.name,
        equipment_type=eq.equipment_type,
        temperature=eq.temperature,
        runtime_hours=eq.runtime_hours,
        efficiency=eq.efficiency,
        last_maintenance=eq.last_maintenance,
        nominal_temp=nominal_temp,
        is_faulty=(eq.status == "OFFLINE"),
    )

    return EquipmentHealthOut(
        equipment_id=eq.id,
        equipment_name=eq.name,
        equipment_type=eq.equipment_type,
        health_score=health_res["health_score"],
        status=health_res["status"],
        contributing_factors=health_res["factors"],
        recommendation=health_res["recommendation"],
        updated_at=eq.updated_at,
    )

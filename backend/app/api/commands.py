import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.command import (
    CommandPreviewRequest,
    CommandPreviewResponse,
    CommandRequest,
    CommandResponse,
)
from app.schemas.operations import LoadShedRequest, LoadRestoreRequest, EmergencyModeRequest
from app.services.station_service import station_service
from app.services.command_service import command_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stations/{station_id}/commands", tags=["Remote Operations & Commands"])


@router.post("/preview", response_model=CommandPreviewResponse)
def preview_command(
    station_id: str,
    preview_req: CommandPreviewRequest,
    db: Session = Depends(get_db),
):
    """Calculates a Digital Twin simulation preview of projected impact before executing a command."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return command_service.preview_command(db, station.id, preview_req)


@router.post("", response_model=CommandResponse)
async def execute_generic_command(
    station_id: str,
    command_req: CommandRequest,
    db: Session = Depends(get_db),
):
    """Executes a validated remote operator command through safety interlocks on the Digital Twin."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return await command_service.execute_command(db, station.id, command_req)


@router.post("/generators/{equipment_id}/start", response_model=CommandResponse)
async def start_generator(
    station_id: str,
    equipment_id: int,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("OPERATOR"),
    db: Session = Depends(get_db),
):
    """Initiates remote generator startup and microgrid synchronization."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="START_GENERATOR",
        target_type="EQUIPMENT",
        target_id=equipment_id,
        requested_by=requested_by,
        role=role,
        reason="Remote operator generator dispatch",
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/generators/{equipment_id}/stop", response_model=CommandResponse)
async def stop_generator(
    station_id: str,
    equipment_id: int,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("SUPERVISOR"),
    db: Session = Depends(get_db),
):
    """Initiates remote generator shutdown to STANDBY with single-generator safety interlock check."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="STOP_GENERATOR",
        target_type="EQUIPMENT",
        target_id=equipment_id,
        requested_by=requested_by,
        role=role,
        reason="Remote operator generator shutdown",
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/load-shed", response_model=CommandResponse)
async def shed_load(
    station_id: str,
    load_req: LoadShedRequest,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("OPERATOR"),
    db: Session = Depends(get_db),
):
    """Executes automated non-critical load shedding to reduce active microgrid deficit."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="LOAD_SHED",
        target_type="LOAD_GROUP",
        parameters={"load_group": load_req.load_group},
        requested_by=requested_by,
        role=role,
        reason=load_req.reason,
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/load-restore", response_model=CommandResponse)
async def restore_load(
    station_id: str,
    load_req: LoadRestoreRequest,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("OPERATOR"),
    db: Session = Depends(get_db),
):
    """Restores previously shed loads with safety headroom verification."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="LOAD_RESTORE",
        target_type="LOAD_GROUP",
        parameters={"load_group": load_req.load_group},
        requested_by=requested_by,
        role=role,
        reason=load_req.reason,
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/emergency-mode", response_model=CommandResponse)
async def toggle_emergency_mode(
    station_id: str,
    em_req: EmergencyModeRequest,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("SUPERVISOR"),
    db: Session = Depends(get_db),
):
    """Sets station emergency protocol mode."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    cmd_type = "ENTER_EMERGENCY_MODE" if em_req.enabled else "EXIT_EMERGENCY_MODE"
    req = CommandRequest(
        command_type=cmd_type,
        target_type="STATION",
        requested_by=requested_by,
        role=role,
        reason=em_req.reason,
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/equipment/{equipment_id}/restart", response_model=CommandResponse)
async def restart_equipment(
    station_id: str,
    equipment_id: int,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("OPERATOR"),
    db: Session = Depends(get_db),
):
    """Restarts target station equipment."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="RESTART_EQUIPMENT",
        target_type="EQUIPMENT",
        target_id=equipment_id,
        requested_by=requested_by,
        role=role,
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/equipment/{equipment_id}/shutdown", response_model=CommandResponse)
async def shutdown_equipment(
    station_id: str,
    equipment_id: int,
    confirmed: bool = Query(False),
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("SUPERVISOR"),
    db: Session = Depends(get_db),
):
    """Shuts down target station equipment with critical infrastructure safety interlocks."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="SHUTDOWN_EQUIPMENT",
        target_type="EQUIPMENT",
        target_id=equipment_id,
        confirmed=confirmed,
        requested_by=requested_by,
        role=role,
    )
    return await command_service.execute_command(db, station.id, req)


@router.post("/equipment/{equipment_id}/isolate", response_model=CommandResponse)
async def isolate_equipment(
    station_id: str,
    equipment_id: int,
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("SUPERVISOR"),
    db: Session = Depends(get_db),
):
    """Isolates target equipment for physical maintenance lock-out."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    req = CommandRequest(
        command_type="ISOLATE_EQUIPMENT",
        target_type="EQUIPMENT",
        target_id=equipment_id,
        requested_by=requested_by,
        role=role,
    )
    return await command_service.execute_command(db, station.id, req)

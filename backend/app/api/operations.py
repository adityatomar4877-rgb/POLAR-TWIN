import logging
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.audit import OperationalRecommendation
from app.schemas.operations import (
    OperationsStatusOut,
    OperationalRecommendationOut,
    LoadGroupOut,
    AuditLogOut,
)
from app.schemas.command import CommandResponse, CommandRequest
from app.services.station_service import station_service
from app.services.operations_service import operations_service
from app.services.audit_service import audit_service
from app.services.command_service import command_service
from app.core.security import APIError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Operations & Decision Support"])


@router.get("/stations/{station_id}/operations", response_model=OperationsStatusOut)
def get_station_operations_status(
    station_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves high-level operations, load groups, and active recommendations for a station."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return operations_service.get_operations_status(db, station.id)


@router.get("/stations/{station_id}/operations/history", response_model=List[AuditLogOut])
def get_station_operations_history(
    station_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieves immutable audit trail of operator commands and system state transitions."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    return audit_service.get_audit_history(db, station.id, limit=limit, offset=offset)


@router.get("/stations/{station_id}/recommendations", response_model=List[OperationalRecommendationOut])
def get_station_recommendations(
    station_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves active, actionable operational recommendations generated from live station conditions."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    recs = operations_service.generate_recommendations(db, station.id)
    return [
        OperationalRecommendationOut(
            id=i + 1,
            station_id=station.id,
            severity=r.severity,
            category=r.category,
            title=r.title,
            explanation=r.explanation,
            suggested_action=r.suggested_action,
            target_command_type=r.target_command_type,
            target_equipment_id=r.target_equipment_id,
            status=r.status,
            created_at=r.created_at,
            expires_at=r.expires_at,
        ) for i, r in enumerate(recs)
    ]


@router.post("/recommendations/{recommendation_id}/execute", response_model=CommandResponse)
async def execute_recommendation(
    recommendation_id: int,
    station_id: str = Query("bharati"),
    requested_by: str = Query("Operator_Demo"),
    role: str = Query("OPERATOR"),
    db: Session = Depends(get_db),
):
    """
    Executes the action associated with an operational recommendation,
    completing the loop: RECOMMEND -> AUTHORIZE -> EXECUTE -> AUDIT.
    """
    station = station_service.get_station_by_id_or_code(db, station_id)
    recs = operations_service.generate_recommendations(db, station.id)
    if recommendation_id < 1 or recommendation_id > len(recs):
        raise APIError(code="RECOMMENDATION_NOT_FOUND", message=f"Recommendation #{recommendation_id} not found.", status_code=404)

    target_rec = recs[recommendation_id - 1]
    if not target_rec.target_command_type:
        raise APIError(code="NON_EXECUTABLE_RECOMMENDATION", message="Recommendation has no direct executable command.", status_code=400)

    import json
    params = json.loads(target_rec.target_parameters_json) if target_rec.target_parameters_json else {}

    cmd_req = CommandRequest(
        command_type=target_rec.target_command_type,
        target_type="EQUIPMENT" if target_rec.target_equipment_id else "LOAD_GROUP",
        target_id=target_rec.target_equipment_id,
        parameters=params,
        reason=f"Executed from Recommendation: {target_rec.title}",
        requested_by=requested_by,
        role=role,
    )

    response = await command_service.execute_command(db, station.id, cmd_req)
    return response


@router.get("/stations/{station_id}/loads", response_model=List[LoadGroupOut])
def get_station_loads(
    station_id: str,
    db: Session = Depends(get_db),
):
    """Retrieves all electrical load groups for a research station."""
    station = station_service.get_station_by_id_or_code(db, station_id)
    loads = operations_service.get_station_loads(db, station.id)
    return [LoadGroupOut.model_validate(l) for l in loads]

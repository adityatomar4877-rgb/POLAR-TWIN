import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.maintenance import MaintenanceTask, ResupplyRequest
from app.models.equipment import Equipment
from app.schemas.maintenance import MaintenanceTaskCreate, ResupplyRequestCreate
from app.services.audit_service import audit_service
from app.core.security import APIError

logger = logging.getLogger(__name__)


class MaintenanceService:
    @staticmethod
    def create_maintenance_task(
        db: Session, station_id: int, task_in: MaintenanceTaskCreate
    ) -> MaintenanceTask:
        # Validate equipment if provided
        eq = None
        if task_in.equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == task_in.equipment_id, Equipment.station_id == station_id).first()
            if not eq:
                raise APIError(
                    code="EQUIPMENT_NOT_FOUND",
                    message=f"Equipment #{task_in.equipment_id} not found on Station #{station_id}.",
                    status_code=404,
                )

        task = MaintenanceTask(
            station_id=station_id,
            equipment_id=task_in.equipment_id,
            title=task_in.title,
            description=task_in.description,
            priority=task_in.priority.upper(),
            status="OPEN",
            recommended_by=task_in.recommended_by,
            assigned_to=task_in.assigned_to,
            created_at=datetime.now(timezone.utc),
            scheduled_for=task_in.scheduled_for,
        )
        db.add(task)
        db.flush()

        audit_service.log_action(
            db=db,
            station_id=station_id,
            actor=task_in.recommended_by,
            action="CREATE_MAINTENANCE_TASK",
            target=f"Task: {task.title} (Equipment: {eq.name if eq else 'Station'})",
            result="SUCCESS",
        )
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get_maintenance_tasks(
        db: Session, station_id: int, status: Optional[str] = None
    ) -> List[MaintenanceTask]:
        query = db.query(MaintenanceTask).filter(MaintenanceTask.station_id == station_id)
        if status:
            query = query.filter(MaintenanceTask.status == status.upper())
        return query.order_by(MaintenanceTask.created_at.desc()).all()

    @staticmethod
    def complete_maintenance_task(
        db: Session, task_id: int, completed_by: str = "Operator_Demo"
    ) -> MaintenanceTask:
        task = db.query(MaintenanceTask).filter(MaintenanceTask.id == task_id).first()
        if not task:
            raise APIError(
                code="MAINTENANCE_TASK_NOT_FOUND",
                message=f"Maintenance task #{task_id} not found.",
                status_code=404,
            )

        now = datetime.now(timezone.utc)
        task.status = "COMPLETED"
        task.completed_at = now

        # If task was associated with an OFFLINE/tripped equipment, restore health & allow restart
        if task.equipment_id:
            eq = db.query(Equipment).filter(Equipment.id == task.equipment_id).first()
            if eq:
                if eq.status == "OFFLINE":
                    eq.status = "STANDBY"
                eq.health_score = 92.0
                eq.efficiency = 94.0
                eq.last_maintenance = now

        audit_service.log_action(
            db=db,
            station_id=task.station_id,
            actor=completed_by,
            action="COMPLETE_MAINTENANCE_TASK",
            target=f"Task #{task.id}: {task.title}",
            result="SUCCESS",
        )
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def create_resupply_request(
        db: Session, station_id: int, resupply_in: ResupplyRequestCreate
    ) -> ResupplyRequest:
        now = datetime.now(timezone.utc)
        req = ResupplyRequest(
            station_id=station_id,
            item=resupply_in.item.upper(),
            quantity=resupply_in.quantity,
            unit=resupply_in.unit,
            priority=resupply_in.priority.upper(),
            reason=resupply_in.reason,
            status="REQUESTED",
            requested_by=resupply_in.requested_by,
            requested_at=now,
        )
        db.add(req)
        db.flush()

        audit_service.log_action(
            db=db,
            station_id=station_id,
            actor=resupply_in.requested_by,
            action="CREATE_RESUPPLY_REQUEST",
            target=f"Item: {req.item} ({req.quantity} {req.unit})",
            result="SUCCESS",
        )
        db.commit()
        db.refresh(req)
        return req

    @staticmethod
    def get_resupply_requests(db: Session, station_id: int) -> List[ResupplyRequest]:
        return (
            db.query(ResupplyRequest)
            .filter(ResupplyRequest.station_id == station_id)
            .order_by(ResupplyRequest.requested_at.desc())
            .all()
        )


maintenance_service = MaintenanceService()

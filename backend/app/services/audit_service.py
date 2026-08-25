import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        station_id: int,
        actor: str,
        action: str,
        target: str,
        result: str = "SUCCESS",
        command_id: Optional[int] = None,
        previous_state: Optional[Dict[str, Any]] = None,
        new_state: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Creates an immutable audit log entry for remote operations and state changes."""
        prev_str = json.dumps(previous_state) if previous_state else None
        new_str = json.dumps(new_state) if new_state else None

        entry = AuditLog(
            station_id=station_id,
            command_id=command_id,
            actor=actor or "Operator_Demo",
            action=action,
            target=target,
            previous_state_json=prev_str,
            new_state_json=new_str,
            result=result,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(entry)
        db.flush()
        logger.info(f"[AUDIT] [{result}] Station #{station_id} | Actor: {actor} | Action: {action} on {target}")
        return entry

    @staticmethod
    def get_audit_history(
        db: Session, station_id: int, limit: int = 50, offset: int = 0
    ) -> List[AuditLog]:
        return (
            db.query(AuditLog)
            .filter(AuditLog.station_id == station_id)
            .order_by(AuditLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )


audit_service = AuditService()

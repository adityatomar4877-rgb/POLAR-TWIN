from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Command(Base):
    __tablename__ = "commands"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    command_type = Column(String(100), nullable=False)  # START_GENERATOR, STOP_GENERATOR, LOAD_SHED, LOAD_RESTORE, ENTER_EMERGENCY_MODE, EXIT_EMERGENCY_MODE, RESTART_EQUIPMENT, SHUTDOWN_EQUIPMENT, ISOLATE_EQUIPMENT
    target_type = Column(String(50), nullable=False)    # EQUIPMENT, LOAD_GROUP, STATION, LOGISTICS
    target_id = Column(Integer, nullable=True)          # e.g. equipment_id or load_group_id
    requested_by = Column(String(100), default="Operator_Demo", nullable=False)
    role = Column(String(50), default="OPERATOR", nullable=False) # VIEWER, OPERATOR, SUPERVISOR, ADMIN
    status = Column(String(50), default="REQUESTED", nullable=False) # REQUESTED, VALIDATING, APPROVED, REJECTED, EXECUTING, COMPLETED, FAILED, CANCELLED
    parameters_json = Column(Text, nullable=True)       # Serialized JSON dict of command arguments
    reason = Column(Text, nullable=True)
    validation_result = Column(Text, nullable=True)
    safety_result = Column(Text, nullable=True)
    previous_state_json = Column(Text, nullable=True)
    resulting_state_json = Column(Text, nullable=True)
    failure_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    executed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    station = relationship("Station", back_populates="commands")

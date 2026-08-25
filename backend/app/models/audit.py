from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    command_id = Column(Integer, ForeignKey("commands.id", ondelete="SET NULL"), nullable=True, index=True)
    actor = Column(String(100), default="Operator_Demo", nullable=False)
    action = Column(String(100), nullable=False)
    target = Column(String(200), nullable=False)
    previous_state_json = Column(Text, nullable=True)
    new_state_json = Column(Text, nullable=True)
    result = Column(String(50), default="SUCCESS", nullable=False) # SUCCESS, FAILED, REJECTED
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    station = relationship("Station", back_populates="audit_logs")
    command = relationship("Command")


class LoadGroup(Base):
    __tablename__ = "load_groups"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False) # CRITICAL, HIGH_PRIORITY, NON_CRITICAL
    current_power_kw = Column(Float, default=15.0, nullable=False)
    priority = Column(Integer, default=1, nullable=False) # 1 = highest, 5 = lowest
    enabled = Column(Boolean, default=True, nullable=False)
    shedable = Column(Boolean, default=False, nullable=False)

    # Relationships
    station = relationship("Station", back_populates="load_groups")


class OperationalRecommendation(Base):
    __tablename__ = "operational_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    severity = Column(String(20), default="INFO", nullable=False) # INFO, WARNING, CRITICAL
    category = Column(String(50), default="ENERGY", nullable=False) # ENERGY, EQUIPMENT, LOGISTICS, ENVIRONMENT
    title = Column(String(200), nullable=False)
    explanation = Column(Text, nullable=False)
    suggested_action = Column(String(200), nullable=False)
    target_command_type = Column(String(100), nullable=True)
    target_equipment_id = Column(Integer, nullable=True)
    target_parameters_json = Column(Text, nullable=True)
    affected_systems_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="ACTIVE", nullable=False) # ACTIVE, ACCEPTED, DISMISSED, EXECUTED, EXPIRED

    # Relationships
    station = relationship("Station", back_populates="recommendations")

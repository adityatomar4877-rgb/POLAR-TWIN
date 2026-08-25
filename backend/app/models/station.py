from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevation = Column(Float, nullable=False)
    status = Column(String(50), default="OPERATIONAL", nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    sensors = relationship("SensorTelemetry", back_populates="station", cascade="all, delete-orphan", order_by="desc(SensorTelemetry.timestamp)")
    energy_telemetry = relationship("EnergyTelemetry", back_populates="station", cascade="all, delete-orphan", order_by="desc(EnergyTelemetry.timestamp)")
    equipment = relationship("Equipment", back_populates="station", cascade="all, delete-orphan")
    logistics = relationship("LogisticsItem", back_populates="station", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="station", cascade="all, delete-orphan", order_by="desc(Alert.created_at)")
    predictions = relationship("Prediction", back_populates="station", cascade="all, delete-orphan")
    commands = relationship("Command", back_populates="station", cascade="all, delete-orphan", order_by="desc(Command.created_at)")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="station", cascade="all, delete-orphan", order_by="desc(MaintenanceTask.created_at)")
    resupply_requests = relationship("ResupplyRequest", back_populates="station", cascade="all, delete-orphan", order_by="desc(ResupplyRequest.requested_at)")
    audit_logs = relationship("AuditLog", back_populates="station", cascade="all, delete-orphan", order_by="desc(AuditLog.timestamp)")
    load_groups = relationship("LoadGroup", back_populates="station", cascade="all, delete-orphan")
    recommendations = relationship("OperationalRecommendation", back_populates="station", cascade="all, delete-orphan", order_by="desc(OperationalRecommendation.created_at)")

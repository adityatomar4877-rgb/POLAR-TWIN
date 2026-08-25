from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(50), default="MEDIUM", nullable=False) # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(50), default="OPEN", nullable=False)     # OPEN, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    recommended_by = Column(String(100), default="AnomalyEngine", nullable=False)
    assigned_to = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    scheduled_for = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    station = relationship("Station", back_populates="maintenance_tasks")
    equipment = relationship("Equipment")


class ResupplyRequest(Base):
    __tablename__ = "resupply_requests"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    item = Column(String(100), nullable=False)          # FUEL, FOOD, MEDICAL, SPARE_PARTS, WATER, OTHER
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)           # liters, kg, kits, units
    priority = Column(String(50), default="MEDIUM", nullable=False) # LOW, MEDIUM, HIGH, CRITICAL
    reason = Column(Text, nullable=True)
    status = Column(String(50), default="REQUESTED", nullable=False) # REQUESTED, APPROVED, IN_TRANSIT, ARRIVED, CANCELLED
    requested_by = Column(String(100), default="Operator_Demo", nullable=False)
    requested_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    expected_arrival = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    station = relationship("Station", back_populates="resupply_requests")

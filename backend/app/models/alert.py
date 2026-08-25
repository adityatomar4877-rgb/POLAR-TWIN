from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False) # ENERGY, EQUIPMENT, ENVIRONMENT, LOGISTICS, SYSTEM, PREDICTION
    severity = Column(String(20), nullable=False)   # INFO, WARNING, CRITICAL
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    source = Column(String(100), default="AlertEngine", nullable=False)
    related_entity_id = Column(Integer, nullable=True) # e.g. equipment_id or logistics_id
    acknowledged = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    station = relationship("Station", back_populates="alerts")

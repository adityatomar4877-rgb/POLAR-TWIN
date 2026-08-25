from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    equipment_type = Column(String(50), nullable=False) # GENERATOR, BATTERY_BANK, HVAC, WATER_TREATMENT, COMMUNICATIONS, SOLAR_ARRAY
    status = Column(String(50), default="NORMAL", nullable=False) # NORMAL, WARNING, CRITICAL, OFFLINE, MAINTENANCE
    health_score = Column(Float, default=100.0, nullable=False) # 0 - 100
    temperature = Column(Float, default=25.0, nullable=False)   # Operating temperature in °C
    runtime_hours = Column(Float, default=0.0, nullable=False)
    efficiency = Column(Float, default=100.0, nullable=False)   # 0 - 100%
    last_maintenance = Column(DateTime, nullable=True)
    next_maintenance = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    station = relationship("Station", back_populates="equipment")

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class EnergyTelemetry(Base):
    __tablename__ = "energy_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    generation_kw = Column(Float, nullable=False)
    consumption_kw = Column(Float, nullable=False)
    energy_balance = Column(Float, nullable=False)   # generation_kw - consumption_kw
    
    battery_percentage = Column(Float, nullable=False)  # 0 - 100
    battery_power_kw = Column(Float, default=0.0, nullable=False) # + charging, - discharging
    
    diesel_generation_kw = Column(Float, default=0.0, nullable=False)
    solar_generation_kw = Column(Float, default=0.0, nullable=False)
    
    fuel_percentage = Column(Float, nullable=False)     # 0 - 100
    grid_status = Column(String(50), default="ONLINE", nullable=False)  # ONLINE, ISLANDED, DEGRADED, EMERGENCY
    
    source = Column(String(100), default="simulation", nullable=False)
    is_simulated = Column(Boolean, default=True, nullable=False)

    # Relationships
    station = relationship("Station", back_populates="energy_telemetry")

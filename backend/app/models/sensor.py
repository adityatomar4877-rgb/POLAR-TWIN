from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class SensorTelemetry(Base):
    __tablename__ = "sensor_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    temperature = Column(Float, nullable=False)        # °C
    wind_speed = Column(Float, nullable=False)         # km/h
    wind_direction = Column(Float, nullable=False)     # degrees (0-360)
    pressure = Column(Float, nullable=False)           # hPa
    humidity = Column(Float, nullable=False)           # %
    precipitation = Column(Float, default=0.0, nullable=False)  # mm
    visibility = Column(Float, default=10.0, nullable=False)    # km
    source = Column(String(100), default="simulation", nullable=False)
    is_simulated = Column(Boolean, default=True, nullable=False)

    # Relationships
    station = relationship("Station", back_populates="sensors")

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(50), nullable=False) # ENERGY_CONSUMPTION, FUEL_DEPLETION, EQUIPMENT_HEALTH
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    horizon_hours = Column(Integer, default=6, nullable=False)
    predicted_value = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    confidence = Column(Float, default=0.95, nullable=True)
    model_name = Column(String(100), default="StatisticalRegressionFallback", nullable=False)
    metadata_json = Column(Text, nullable=True)

    # Relationships
    station = relationship("Station", back_populates="predictions")

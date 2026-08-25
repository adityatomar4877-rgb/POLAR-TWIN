from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class LogisticsItem(Base):
    __tablename__ = "logistics_items"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True)
    item_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False) # FUEL, FOOD, MEDICAL, SPARE_PARTS, WATER, OTHER
    quantity = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)      # liters, kg, packs, units
    daily_consumption = Column(Float, default=1.0, nullable=False)
    minimum_threshold = Column(Float, nullable=False)
    days_remaining = Column(Float, nullable=False)
    status = Column(String(50), default="NORMAL", nullable=False) # NORMAL, WARNING, CRITICAL
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    station = relationship("Station", back_populates="logistics")

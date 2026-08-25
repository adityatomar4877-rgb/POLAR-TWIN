from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class LogisticsItemBase(BaseModel):
    item_name: str = Field(..., json_schema_extra={"example": "Arctic Diesel Fuel"})
    category: str = Field(..., json_schema_extra={"example": "FUEL"})
    quantity: float = Field(..., ge=0.0, json_schema_extra={"example": 45000.0})
    unit: str = Field(..., json_schema_extra={"example": "liters"})
    daily_consumption: float = Field(..., ge=0.0, json_schema_extra={"example": 1200.0})
    minimum_threshold: float = Field(..., ge=0.0, json_schema_extra={"example": 10000.0})
    days_remaining: float = Field(..., ge=0.0, json_schema_extra={"example": 37.5})
    status: str = Field(default="NORMAL", json_schema_extra={"example": "NORMAL"})


class LogisticsItemCreate(LogisticsItemBase):
    station_id: int


class LogisticsItemOut(LogisticsItemBase):
    id: int
    station_id: int
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LogisticsForecastOut(BaseModel):
    station_id: int
    critical_items_count: int
    warning_items_count: int
    items: List[LogisticsItemOut]
    resupply_recommendations: List[str]

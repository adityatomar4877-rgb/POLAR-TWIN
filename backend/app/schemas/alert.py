from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class AlertBase(BaseModel):
    alert_type: str = Field(..., json_schema_extra={"example": "ENERGY"})
    severity: str = Field(..., json_schema_extra={"example": "WARNING"})
    title: str = Field(..., json_schema_extra={"example": "Low Battery Reserve"})
    message: str = Field(..., json_schema_extra={"example": "Battery storage capacity dropped below 20%."})
    source: str = Field(default="AlertEngine", json_schema_extra={"example": "AlertEngine"})
    related_entity_id: Optional[int] = None
    acknowledged: bool = False


class AlertCreate(AlertBase):
    station_id: int


class AlertOut(AlertBase):
    id: int
    station_id: int
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AlertAcknowledge(BaseModel):
    acknowledged: bool = True

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EquipmentBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Generator 1"})
    equipment_type: str = Field(..., json_schema_extra={"example": "GENERATOR"})
    status: str = Field(default="NORMAL", json_schema_extra={"example": "NORMAL"})
    health_score: float = Field(..., ge=0.0, le=100.0, json_schema_extra={"example": 92.5})
    temperature: float = Field(..., json_schema_extra={"example": 68.0})
    runtime_hours: float = Field(..., ge=0.0, json_schema_extra={"example": 1240.5})
    efficiency: float = Field(..., ge=0.0, le=100.0, json_schema_extra={"example": 94.0})
    last_maintenance: Optional[datetime] = None
    next_maintenance: Optional[datetime] = None


class EquipmentCreate(EquipmentBase):
    station_id: int


class EquipmentOut(EquipmentBase):
    id: int
    station_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EquipmentHealthOut(BaseModel):
    equipment_id: int
    equipment_name: str
    equipment_type: str
    health_score: float
    status: str
    contributing_factors: List[str]
    recommendation: str
    updated_at: datetime

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MaintenanceTaskCreate(BaseModel):
    equipment_id: Optional[int] = Field(None, json_schema_extra={"example": 1})
    title: str = Field(..., json_schema_extra={"example": "Generator 1 Oil Filter & Valve Inspection"})
    description: Optional[str] = Field(None, json_schema_extra={"example": "Routine servicing and thermal threshold inspection."})
    priority: str = Field(default="MEDIUM", json_schema_extra={"example": "HIGH"}) # LOW, MEDIUM, HIGH, CRITICAL
    recommended_by: str = Field(default="Operator_Action", json_schema_extra={"example": "AnomalyEngine"})
    assigned_to: Optional[str] = Field(None, json_schema_extra={"example": "Station Chief Engineer"})
    scheduled_for: Optional[datetime] = None


class MaintenanceTaskOut(BaseModel):
    id: int
    station_id: int
    equipment_id: Optional[int]
    title: str
    description: Optional[str]
    priority: str
    status: str
    recommended_by: str
    assigned_to: Optional[str]
    created_at: datetime
    scheduled_for: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class ResupplyRequestCreate(BaseModel):
    item: str = Field(..., json_schema_extra={"example": "FUEL"})
    quantity: float = Field(..., ge=1.0, json_schema_extra={"example": 15000.0})
    unit: str = Field(default="liters", json_schema_extra={"example": "liters"})
    priority: str = Field(default="HIGH", json_schema_extra={"example": "HIGH"})
    reason: Optional[str] = Field(None, json_schema_extra={"example": "Projected critical reserve before winter freeze"})
    requested_by: str = Field(default="Operator_Demo", json_schema_extra={"example": "Operator_Demo"})


class ResupplyRequestOut(BaseModel):
    id: int
    station_id: int
    item: str
    quantity: float
    unit: str
    priority: str
    reason: Optional[str]
    status: str
    requested_by: str
    requested_at: datetime
    expected_arrival: Optional[datetime]
    completed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)

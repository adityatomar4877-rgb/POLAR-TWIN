from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class CommandRequest(BaseModel):
    command_type: str = Field(..., json_schema_extra={"example": "START_GENERATOR"})
    target_type: str = Field(default="EQUIPMENT", json_schema_extra={"example": "EQUIPMENT"})
    target_id: Optional[int] = Field(None, json_schema_extra={"example": 2})
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)
    reason: Optional[str] = Field(None, json_schema_extra={"example": "Mitigate microgrid energy deficit"})
    requested_by: str = Field(default="Operator_Demo", json_schema_extra={"example": "Operator_Demo"})
    role: str = Field(default="OPERATOR", json_schema_extra={"example": "OPERATOR"})
    confirmed: bool = Field(default=False, description="Explicit confirmation for high-risk commands")


class CommandPreviewRequest(BaseModel):
    command_type: str = Field(..., json_schema_extra={"example": "START_GENERATOR"})
    target_id: Optional[int] = Field(None, json_schema_extra={"example": 2})
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict)


class CommandPreviewResponse(BaseModel):
    command_type: str
    safe: bool
    requires_confirmation: bool
    current_state: Dict[str, Any]
    projected_state: Dict[str, Any]
    impact: Dict[str, Any]
    warnings: List[str]
    recommendations: List[str]


class CommandResponse(BaseModel):
    success: bool
    command_id: int
    command_type: str
    station_id: int
    station_code: str
    status: str
    target: Dict[str, Any]
    previous_state: Dict[str, Any]
    new_state: Dict[str, Any]
    system_impact: Dict[str, Any]
    message: str
    executed_at: Optional[datetime] = None


class CommandHistoryOut(BaseModel):
    id: int
    station_id: int
    command_type: str
    target_type: str
    target_id: Optional[int]
    requested_by: str
    role: str
    status: str
    reason: Optional[str] = None
    validation_result: Optional[str] = None
    safety_result: Optional[str] = None
    failure_reason: Optional[str] = None
    created_at: datetime
    executed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

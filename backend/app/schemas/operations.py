from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class LoadGroupOut(BaseModel):
    id: int
    station_id: int
    name: str
    category: str # CRITICAL, HIGH_PRIORITY, NON_CRITICAL
    current_power_kw: float
    priority: int
    enabled: bool
    shedable: bool

    model_config = ConfigDict(from_attributes=True)


class LoadShedRequest(BaseModel):
    load_group: str = Field(default="NON_CRITICAL", json_schema_extra={"example": "NON_CRITICAL"})
    reason: Optional[str] = Field(default="Energy deficit mitigation", json_schema_extra={"example": "Energy deficit mitigation"})


class LoadRestoreRequest(BaseModel):
    load_group: str = Field(default="ALL", json_schema_extra={"example": "ALL"})
    reason: Optional[str] = Field(default="Generation capacity restored", json_schema_extra={"example": "Generation capacity restored"})


class EmergencyModeRequest(BaseModel):
    enabled: bool = Field(..., json_schema_extra={"example": True})
    reason: Optional[str] = Field(default="Generator failure outage", json_schema_extra={"example": "Generator failure outage"})


class OperationalRecommendationOut(BaseModel):
    id: int
    station_id: int
    severity: str # INFO, WARNING, CRITICAL
    category: str # ENERGY, EQUIPMENT, LOGISTICS, ENVIRONMENT
    title: str
    explanation: str
    suggested_action: str
    target_command_type: Optional[str] = None
    target_equipment_id: Optional[int] = None
    status: str # ACTIVE, ACCEPTED, DISMISSED, EXECUTED, EXPIRED
    created_at: datetime
    expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogOut(BaseModel):
    id: int
    station_id: int
    command_id: Optional[int] = None
    actor: str
    action: str
    target: str
    result: str
    timestamp: datetime
    previous_state_json: Optional[str] = None
    new_state_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OperationsStatusOut(BaseModel):
    station_id: int
    station_code: str
    operational_mode: str # NORMAL, DEGRADED, EMERGENCY
    active_commands_count: int
    active_recommendations_count: int
    pending_maintenance_count: int
    pending_resupply_count: int
    load_shed_active: bool
    total_active_load_kw: float
    total_shed_load_kw: float
    active_recommendations: List[OperationalRecommendationOut]
    loads: List[LoadGroupOut]

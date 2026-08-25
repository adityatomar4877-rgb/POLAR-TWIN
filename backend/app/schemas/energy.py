from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EnergyTelemetryBase(BaseModel):
    generation_kw: float = Field(..., ge=0.0, description="Total active generation in kW", json_schema_extra={"example": 180.0})
    consumption_kw: float = Field(..., ge=0.0, description="Total station power consumption in kW", json_schema_extra={"example": 140.0})
    energy_balance: float = Field(..., description="Generation minus consumption (kW)", json_schema_extra={"example": 40.0})
    battery_percentage: float = Field(..., ge=0.0, le=100.0, description="Battery state of charge (%)", json_schema_extra={"example": 85.0})
    battery_power_kw: float = Field(default=0.0, description="Battery net power (+ charging, - discharging)", json_schema_extra={"example": -15.0})
    diesel_generation_kw: float = Field(default=0.0, ge=0.0, description="Diesel generator output (kW)", json_schema_extra={"example": 120.0})
    solar_generation_kw: float = Field(default=0.0, ge=0.0, description="Solar PV output (kW)", json_schema_extra={"example": 60.0})
    fuel_percentage: float = Field(..., ge=0.0, le=100.0, description="Available fuel tank level (%)", json_schema_extra={"example": 72.5})
    grid_status: str = Field(default="ONLINE", description="Microgrid operational mode", json_schema_extra={"example": "ONLINE"})
    source: str = Field(default="simulation", description="Data provenance", json_schema_extra={"example": "simulation"})
    is_simulated: bool = Field(default=True, description="Whether telemetry is simulated", json_schema_extra={"example": True})


class EnergyTelemetryCreate(EnergyTelemetryBase):
    station_id: int
    timestamp: Optional[datetime] = None


class EnergyTelemetryOut(EnergyTelemetryBase):
    id: int
    station_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class HistoricalEnergyOut(BaseModel):
    station_id: int
    count: int
    data: List[EnergyTelemetryOut]

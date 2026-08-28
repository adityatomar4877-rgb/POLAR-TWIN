from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class SensorTelemetryBase(BaseModel):
    temperature: float = Field(..., ge=-100.0, le=50.0, description="Temperature in °C", json_schema_extra={"example": -24.5})
    wind_speed: float = Field(..., ge=0.0, le=350.0, description="Wind speed in km/h", json_schema_extra={"example": 42.0})
    wind_direction: float = Field(..., ge=0.0, le=360.0, description="Wind direction in degrees", json_schema_extra={"example": 180.0})
    pressure: float = Field(..., ge=800.0, le=1100.0, description="Atmospheric pressure in hPa", json_schema_extra={"example": 985.0})
    humidity: float = Field(..., ge=0.0, le=100.0, description="Relative humidity in %", json_schema_extra={"example": 65.0})
    precipitation: float = Field(default=0.0, ge=0.0, description="Precipitation in mm", json_schema_extra={"example": 0.0})
    visibility: float = Field(default=10.0, ge=0.0, description="Visibility in km", json_schema_extra={"example": 10.0})
    solar_irradiance_wm2: float = Field(default=0.0, ge=0.0, description="Solar irradiance in W/m²", json_schema_extra={"example": 125.0})
    source: str = Field(default="simulation", description="Provenance of telemetry data", json_schema_extra={"example": "simulation"})
    is_simulated: bool = Field(default=True, description="True if simulated, False if external live API", json_schema_extra={"example": True})


class SensorTelemetryCreate(SensorTelemetryBase):
    station_id: int
    timestamp: Optional[datetime] = None


class SensorTelemetryOut(SensorTelemetryBase):
    id: int
    station_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class HistoricalEnvironmentOut(BaseModel):
    station_id: int
    count: int
    data: List[SensorTelemetryOut]

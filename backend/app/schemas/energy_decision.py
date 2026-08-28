from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EnergyDecisionForecast(BaseModel):
    """Random Forest demand predictions across time horizons."""
    h6_average_kw: float = Field(..., alias="6h_average_kw", serialization_alias="6h_average_kw", description="6h forecast average demand (kW)")
    h12_average_kw: float = Field(..., alias="12h_average_kw", serialization_alias="12h_average_kw", description="12h forecast average demand (kW)")
    h24_average_kw: float = Field(..., alias="24h_average_kw", serialization_alias="24h_average_kw", description="24h forecast average demand (kW)")

    model_config = ConfigDict(populate_by_name=True)


class EnergyDecisionState(BaseModel):
    """Current live microgrid and environmental state."""
    current_consumption_kw: float = Field(..., description="Observed station power consumption (kW)")
    solar_generation_kw: float = Field(..., description="Current solar PV generation (kW)")
    diesel_generation_kw: float = Field(..., description="Current active diesel generator output (kW)")
    available_generation_kw: float = Field(..., description="Total available generation (solar + diesel, excluding battery) (kW)")
    battery_soc_percent: float = Field(..., ge=0.0, le=100.0, description="Battery state of charge (%)")
    battery_power_kw: float = Field(default=0.0, description="Battery net power (+ charging, - discharging) (kW)")
    fuel_level_percent: float = Field(..., ge=0.0, le=100.0, description="Main fuel tank level (%)")
    grid_status: str = Field(..., description="Microgrid grid mode (e.g. ONLINE, ISLANDED, OFFLINE)")
    storm_flag: bool = Field(..., description="Whether active storm/blizzard conditions are present")

    model_config = ConfigDict(populate_by_name=True)


class EnergyDecisionMargin(BaseModel):
    """Generation margin (available generation minus forecast demand) for each horizon."""
    h6_kw: float = Field(..., alias="6h_kw", serialization_alias="6h_kw", description="6h energy margin in kW (available - 6h demand)")
    h12_kw: float = Field(..., alias="12h_kw", serialization_alias="12h_kw", description="12h energy margin in kW (available - 12h demand)")
    h24_kw: float = Field(..., alias="24h_kw", serialization_alias="24h_kw", description="24h energy margin in kW (available - 24h demand)")

    model_config = ConfigDict(populate_by_name=True)


class EnergyDecisionRisk(BaseModel):
    """Synthesized risk level and granular causal reasons."""
    level: str = Field(..., description="Risk classification: NORMAL, WARNING, HIGH_RISK, or CRITICAL")
    reasons: List[str] = Field(default_factory=list, description="Specific conditions driving the risk evaluation")

    model_config = ConfigDict(populate_by_name=True)


class EnergyDecisionResponse(BaseModel):
    """
    Complete Energy Decision Engine response schema.
    Provides transparent decision-support interpreting real RF forecasts and telemetry.
    """
    station_id: int = Field(..., description="Database station identifier")
    station_code: str = Field(..., description="Station alphanumeric code (e.g. MAITRI, BHARATI)")
    generated_at: str = Field(..., description="ISO 8601 UTC timestamp of evaluation")
    status: str = Field(..., description="Overall energy status (NORMAL, WARNING, HIGH_RISK, CRITICAL)")
    forecast: EnergyDecisionForecast = Field(..., description="Random Forest demand forecast")
    energy_state: EnergyDecisionState = Field(..., description="Snapshot of microgrid telemetry")
    energy_margin: EnergyDecisionMargin = Field(..., description="Energy margins against forecast horizons")
    risk: EnergyDecisionRisk = Field(..., description="Risk assessment with granular reasons")
    recommendations: List[str] = Field(default_factory=list, description="Human-readable decision-support recommendations")

    model_config = ConfigDict(populate_by_name=True)

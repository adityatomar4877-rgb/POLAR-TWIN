from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class CustomConditions(BaseModel):
    temperature_c: Optional[float] = Field(None, description="Custom ambient temperature in Celsius (-70.0 to 20.0)")
    wind_speed_kmh: Optional[float] = Field(None, description="Custom wind speed in km/h (0.0 to 200.0)")
    solar_factor: Optional[float] = Field(None, ge=0.0, le=1.0, description="Solar irradiance scaling factor (0.0=polar night, 1.0=full sun)")
    blizzard_warning: Optional[bool] = Field(None, description="Force blizzard warning and extreme weather flag")
    load_modifier_kw: Optional[float] = Field(None, description="Electrical base load delta in kW (e.g. +50.0 for heavy science loads)")
    generator_1_online: Optional[bool] = Field(None, description="Generator 1 online operational status")
    generator_2_online: Optional[bool] = Field(None, description="Generator 2 online operational status")
    battery_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Override or target battery percentage")
    target_equipment_id: Optional[int] = Field(None, description="Target equipment ID for failure or degradation")
    equipment_state: Optional[str] = Field(None, description="Target equipment operational status (NORMAL, WARNING, CRITICAL, OFFLINE)")
    equipment_efficiency: Optional[float] = Field(None, ge=0.0, le=100.0, description="Target equipment efficiency percentage")
    equipment_temp_offset: Optional[float] = Field(None, description="Target equipment temperature offset in Celsius")
    fuel_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Override fuel reserve percentage")
    fuel_burn_multiplier: Optional[float] = Field(None, ge=0.1, le=5.0, description="Fuel consumption rate multiplier")
    resupply_delay_days: Optional[int] = Field(None, ge=0, description="Projected resupply delay in days")


class ScenarioRequest(BaseModel):
    station_id: Union[int, str] = Field(..., description="Station ID or code (e.g. 1 or 'bharati')")
    scenario: str = Field(..., description="Scenario type: NORMAL_OPERATION, GENERATOR_FAILURE, EXTREME_COLD, HIGH_ENERGY_DEMAND, FUEL_SHORTAGE, EQUIPMENT_DEGRADATION, SUPPLY_DELAY, CUSTOM")
    equipment_id: Optional[int] = Field(None, description="Optional target equipment ID for equipment-specific failure")
    duration_minutes: int = Field(default=60, ge=1, le=1440, description="Duration in minutes for scenario effect")
    apply_to_live: bool = Field(default=True, description="Whether to apply this scenario immediately to live simulation")
    custom_conditions: Optional[CustomConditions] = Field(None, description="Detailed custom condition parameters for scenario simulation")


class ScenarioResponse(BaseModel):
    station_id: int
    station_code: str
    scenario: str
    impact: Dict[str, Union[float, int, str, bool]]
    affected_systems: List[str]
    recommendations: List[str]
    applied_to_simulation: bool
    active_until: Optional[datetime] = None
    custom_conditions: Optional[Dict[str, Any]] = None


class SimulationStatusOut(BaseModel):
    is_running: bool
    interval_seconds: int
    last_tick_at: Optional[datetime]
    active_scenarios: Dict[str, str] # station_code -> scenario_name
    active_scenario_expiry: Dict[str, Optional[datetime]]
    total_cycles_executed: int
    active_custom_conditions: Dict[str, Optional[Dict[str, Any]]] = Field(default_factory=dict)


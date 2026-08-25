from datetime import datetime
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, Field


class ScenarioRequest(BaseModel):
    station_id: Union[int, str] = Field(..., description="Station ID or code (e.g. 1 or 'bharati')")
    scenario: str = Field(..., description="Scenario type: NORMAL_OPERATION, GENERATOR_FAILURE, EXTREME_COLD, HIGH_ENERGY_DEMAND, FUEL_SHORTAGE, EQUIPMENT_DEGRADATION, SUPPLY_DELAY")
    equipment_id: Optional[int] = Field(None, description="Optional target equipment ID for equipment-specific failure")
    duration_minutes: int = Field(default=60, ge=1, le=1440, description="Duration in minutes for scenario effect")
    apply_to_live: bool = Field(default=True, description="Whether to apply this scenario immediately to live simulation")


class ScenarioResponse(BaseModel):
    station_id: int
    station_code: str
    scenario: str
    impact: Dict[str, Union[float, int, str]]
    affected_systems: List[str]
    recommendations: List[str]
    applied_to_simulation: bool
    active_until: Optional[datetime] = None


class SimulationStatusOut(BaseModel):
    is_running: bool
    interval_seconds: int
    last_tick_at: Optional[datetime]
    active_scenarios: Dict[str, str] # station_code -> scenario_name
    active_scenario_expiry: Dict[str, Optional[datetime]]
    total_cycles_executed: int

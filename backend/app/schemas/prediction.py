from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EnergyPredictionPoint(BaseModel):
    timestamp: datetime
    predicted_consumption_kw: float
    predicted_generation_kw: float
    predicted_balance_kw: float
    lower_bound_kw: float
    upper_bound_kw: float
    confidence: float = 0.95


class EnergyForecastResponse(BaseModel):
    station_id: int
    station_code: str
    generated_at: datetime
    horizon_hours: int
    model_name: str
    is_fallback: bool
    current_consumption_kw: float
    average_predicted_consumption_kw: float
    forecast: List[EnergyPredictionPoint]


class FuelDepletionForecastResponse(BaseModel):
    station_id: int
    station_code: str
    current_fuel_percentage: float
    current_fuel_liters: float
    estimated_daily_consumption_liters: float
    days_until_critical: float
    critical_threshold_percentage: float
    projected_critical_date: Optional[datetime]
    projected_depletion_date: Optional[datetime]
    recommended_resupply: bool
    status: str
    advisory_notes: str


class PredictionSummaryOut(BaseModel):
    station_id: int
    energy_forecast_24h: EnergyForecastResponse
    fuel_depletion_forecast: FuelDepletionForecastResponse

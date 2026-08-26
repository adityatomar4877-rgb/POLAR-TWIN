from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MLForecastHorizon(BaseModel):
    """Prediction result for a single time horizon."""
    average_consumption_kw: float = Field(..., description="Predicted average consumption in kW for this horizon")


class EnergyForecastResponse(BaseModel):
    """
    Response schema for the Random Forest energy forecast endpoint.
    Each horizon key ('6h', '12h', '24h') maps to a predicted average demand over that window.
    """
    station_id: int
    station_code: str
    generated_at: str
    model_name: str = Field(..., description="Model name (e.g. RandomForestEnergyForecast)")
    is_fallback: bool = Field(..., description="True only if RF models could not be loaded and a fallback was used")
    current_consumption_kw: float = Field(..., description="Latest observed consumption reading in kW")
    forecast: Dict[str, MLForecastHorizon] = Field(
        ..., description="Forecasts keyed by horizon: '6h', '12h', '24h'"
    )
    feature_count: int = Field(..., description="Number of input features used by the model")
    history_records_used: int = Field(..., description="Number of telemetry records used for feature engineering")


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
    energy_forecast: EnergyForecastResponse
    energy_forecast_24h: Optional[EnergyForecastResponse] = None
    fuel_depletion_forecast: FuelDepletionForecastResponse


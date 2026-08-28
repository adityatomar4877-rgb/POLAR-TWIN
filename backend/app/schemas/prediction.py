from datetime import datetime
from typing import Any, Dict, List, Optional
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
    model_version: Optional[str] = Field(None, description="Trained model version")
    is_fallback: bool = Field(..., description="True only if RF models could not be loaded and a fallback was used")
    current_consumption_kw: float = Field(..., description="Latest observed consumption reading in kW")
    forecast: Dict[str, MLForecastHorizon] = Field(
        ..., description="Forecasts keyed by horizon: '6h', '12h', '24h'"
    )
    feature_count: int = Field(..., description="Number of input features used by the model")
    history_records_used: int = Field(..., description="Number of telemetry records used for feature engineering")
    model_metrics: Optional[Dict[str, Any]] = Field(
        None, description="Offline evaluation metrics (MAE/RMSE/MAPE/R2) per horizon"
    )
    trained_on_station: Optional[str] = Field(None, description="Station code the models were trained on")
    cached: Optional[bool] = Field(None, description="True if this result was served from the prediction cache")
    cache_age_seconds: Optional[float] = Field(None, description="Age of the cached result in seconds")
    active_scenario: Optional[str] = Field(None, description="Active what-if scenario affecting this forecast (e.g. EXTREME_COLD)")
    scenario_adjusted: Optional[bool] = Field(None, description="True if the forecast was adjusted for an active scenario")
    scenario_adjustment: Optional[Dict[str, Any]] = Field(
        None, description="Scenario adjustment details: {type, factor, add_kw}"
    )


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
    burn_rate_source: Optional[str] = Field(
        None,
        description="How the daily burn rate was derived: telemetry_learned / logistics_nominal / fallback_constant",
    )


class PredictionSummaryOut(BaseModel):
    station_id: int
    energy_forecast: EnergyForecastResponse
    energy_forecast_24h: Optional[EnergyForecastResponse] = None
    fuel_depletion_forecast: FuelDepletionForecastResponse


class ModelInfoResponse(BaseModel):
    """Metadata and offline evaluation metrics for the deployed ML models."""
    model_name: str
    model_version: str
    model_type: str
    feature_count: int
    trained_on_station: Optional[str] = None
    trained_at: Optional[str] = None
    train_records: Optional[int] = None
    test_records: Optional[int] = None
    history_records_used: Optional[int] = None
    targets: Dict[str, str] = {}
    metrics: Dict[str, Any] = {}


class HorizonAccuracy(BaseModel):
    horizon: str
    horizon_hours: int
    evaluated_predictions: int
    mae_kw: float
    rmse_kw: float
    mape_percent: Optional[float] = None
    mean_actual_kw: Optional[float] = None
    mean_predicted_kw: Optional[float] = None


class PredictionAccuracyResponse(BaseModel):
    """Live forecast-vs-actual accuracy computed from persisted predictions."""
    station_id: int
    station_code: str
    evaluated_at: str
    horizons: List[HorizonAccuracy]
    note: Optional[str] = None


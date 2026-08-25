import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import numpy as np
from sqlalchemy.orm import Session
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.models.station import Station
from app.models.logistics import LogisticsItem
from app.schemas.prediction import (
    EnergyForecastResponse,
    EnergyPredictionPoint,
    FuelDepletionForecastResponse,
)

logger = logging.getLogger(__name__)


class PredictionService:
    @staticmethod
    def forecast_energy(
        db: Session,
        station_id: int,
        station_code: str,
        horizon_hours: int = 24,
    ) -> EnergyForecastResponse:
        """
        Lightweight ML & Statistical Energy Forecast Model.
        Uses scikit-learn Ridge regression if historical data >= 24 records,
        or deterministic physics-based diurnal moving-average fallback.
        """
        now = datetime.now(timezone.utc)
        
        # Retrieve recent history (up to 7 days = 168 hours)
        history = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .limit(168)
            .all()
        )
        # Reverse to chronological order
        history = list(reversed(history))

        recent_weather = (
            db.query(SensorTelemetry)
            .filter(SensorTelemetry.station_id == station_id)
            .order_by(SensorTelemetry.timestamp.desc())
            .limit(168)
            .all()
        )
        weather_map = {w.timestamp.replace(minute=0, second=0, microsecond=0): w for w in recent_weather}

        latest_energy = history[-1] if history else None
        current_consumption = latest_energy.consumption_kw if latest_energy else 120.0
        current_generation = latest_energy.generation_kw if latest_energy else 140.0

        model_name = "LightweightRidgeRegression"
        is_fallback = False

        # Attempt to train simple ML model if enough data
        regressor = None
        if len(history) >= 24:
            try:
                from sklearn.linear_model import Ridge
                X = []
                y = []
                for entry in history:
                    ts = entry.timestamp
                    h = ts.hour
                    d = ts.weekday()
                    # Find matching weather or estimate
                    hour_bucket = ts.replace(minute=0, second=0, microsecond=0)
                    w = weather_map.get(hour_bucket)
                    temp = w.temperature if w else -15.0
                    wind = w.wind_speed if w else 30.0
                    
                    # Cyclical hour features + weather
                    hour_sin = math.sin(2 * math.pi * h / 24.0)
                    hour_cos = math.cos(2 * math.pi * h / 24.0)
                    X.append([hour_sin, hour_cos, d, temp, wind])
                    y.append(entry.consumption_kw)
                
                X_arr = np.array(X)
                y_arr = np.array(y)
                regressor = Ridge(alpha=1.0)
                regressor.fit(X_arr, y_arr)
            except Exception as e:
                logger.warning(f"Error training Ridge model: {e}. Defaulting to moving average fallback.")
                regressor = None

        if regressor is None:
            model_name = "PhysicsDiurnalMovingAverage"
            is_fallback = True

        # Generate future time points
        forecast_points: List[EnergyPredictionPoint] = []
        total_predicted = 0.0

        for step in range(1, horizon_hours + 1):
            future_time = now + timedelta(hours=step)
            f_hour = future_time.hour
            f_weekday = future_time.weekday()
            
            # Estimated temperature for that hour (diurnal cooling at night)
            f_temp_est = -20.0 + 4.0 * math.cos((f_hour - 14) / 24.0 * 2 * math.pi)
            f_wind_est = 35.0

            if regressor is not None and not is_fallback:
                h_sin = math.sin(2 * math.pi * f_hour / 24.0)
                h_cos = math.cos(2 * math.pi * f_hour / 24.0)
                feat = np.array([[h_sin, h_cos, f_weekday, f_temp_est, f_wind_est]])
                pred_c = float(regressor.predict(feat)[0])
            else:
                # Physics fallback: Baseline + temperature thermal factor + diurnal curve
                thermal_load = max(0.0, (-10.0 - f_temp_est) * 1.8)
                diurnal_shift = 15.0 * math.sin((f_hour - 6) / 24.0 * 2 * math.pi)
                pred_c = current_consumption * 0.75 + (40.0 + thermal_load + diurnal_shift) * 0.25

            pred_c = round(max(30.0, pred_c), 2)
            
            # Solar diurnal calculation for future generation
            # Sun is up during daytime hours (10:00 to 18:00)
            solar_potential = max(0.0, math.sin((f_hour - 6) / 12.0 * math.pi)) if 6 <= f_hour <= 18 else 0.0
            pred_g_solar = solar_potential * 45.0
            pred_g_diesel = 100.0 if pred_c > (pred_g_solar + 30.0) else 50.0
            pred_gen = round(pred_g_solar + pred_g_diesel, 2)
            
            pred_bal = round(pred_gen - pred_c, 2)
            error_margin = round(pred_c * 0.08, 2) # 8% uncertainty envelope

            forecast_points.append(
                EnergyPredictionPoint(
                    timestamp=future_time,
                    predicted_consumption_kw=pred_c,
                    predicted_generation_kw=pred_gen,
                    predicted_balance_kw=pred_bal,
                    lower_bound_kw=round(max(0.0, pred_c - error_margin), 2),
                    upper_bound_kw=round(pred_c + error_margin, 2),
                    confidence=0.92 if not is_fallback else 0.85,
                )
            )
            total_predicted += pred_c

        avg_pred = round(total_predicted / horizon_hours, 2)

        return EnergyForecastResponse(
            station_id=station_id,
            station_code=station_code,
            generated_at=now,
            horizon_hours=horizon_hours,
            model_name=model_name,
            is_fallback=is_fallback,
            current_consumption_kw=current_consumption,
            average_predicted_consumption_kw=avg_pred,
            forecast=forecast_points,
        )

    @staticmethod
    def forecast_fuel_depletion(
        db: Session,
        station_id: int,
        station_code: str,
    ) -> FuelDepletionForecastResponse:
        """
        Fuel depletion & critical threshold forecast service.
        Predicts days remaining until critical (10%) and complete depletion.
        """
        now = datetime.now(timezone.utc)

        # Get current fuel telemetry
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        
        # Get fuel logistics item
        fuel_item = (
            db.query(LogisticsItem)
            .filter(LogisticsItem.station_id == station_id, LogisticsItem.category == "FUEL")
            .first()
        )

        current_percentage = latest_energy.fuel_percentage if latest_energy else 65.0
        # Typical Antarctic station fuel storage: ~60,000 Liters (Bharati) / 80,000 Liters (Maitri)
        total_capacity_liters = 75000.0 if "MAITRI" in station_code.upper() else 60000.0
        current_liters = fuel_item.quantity if fuel_item else (total_capacity_liters * current_percentage / 100.0)
        daily_burn_liters = fuel_item.daily_consumption if fuel_item else 1150.0

        critical_threshold_percent = 10.0
        critical_liters = total_capacity_liters * (critical_threshold_percent / 100.0)

        # Calculate estimated depletion timelines
        if daily_burn_liters > 0:
            usable_liters_above_critical = max(0.0, current_liters - critical_liters)
            days_until_critical = round(usable_liters_above_critical / daily_burn_liters, 1)
            days_until_empty = round(current_liters / daily_burn_liters, 1)
            
            projected_critical_date = now + timedelta(days=days_until_critical)
            projected_empty_date = now + timedelta(days=days_until_empty)
        else:
            days_until_critical = 999.0
            days_until_empty = 999.0
            projected_critical_date = None
            projected_empty_date = None

        recommended_resupply = days_until_critical <= 30.0
        
        if days_until_critical < 15.0:
            status = "CRITICAL"
            notes = "Projected fuel depletion imminent. Emergency resupply vessel or fuel conservation protocol required."
        elif days_until_critical < 30.0:
            status = "WARNING"
            notes = "Estimated fuel reserve approaching critical threshold within 30 days. Plan scheduled resupply window."
        else:
            status = "NORMAL"
            notes = "Projected fuel consumption remains within safe operational envelope for the current expedition season."

        return FuelDepletionForecastResponse(
            station_id=station_id,
            station_code=station_code,
            current_fuel_percentage=round(current_percentage, 1),
            current_fuel_liters=round(current_liters, 1),
            estimated_daily_consumption_liters=round(daily_burn_liters, 1),
            days_until_critical=days_until_critical,
            critical_threshold_percentage=critical_threshold_percent,
            projected_critical_date=projected_critical_date,
            projected_depletion_date=projected_empty_date,
            recommended_resupply=recommended_resupply,
            status=status,
            advisory_notes=notes,
        )


prediction_service = PredictionService()

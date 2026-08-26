import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.energy import EnergyTelemetry
from app.models.logistics import LogisticsItem
from app.schemas.prediction import FuelDepletionForecastResponse

logger = logging.getLogger(__name__)


class PredictionService:

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

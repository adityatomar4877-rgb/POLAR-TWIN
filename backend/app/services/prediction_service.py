import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.energy import EnergyTelemetry
from app.models.logistics import LogisticsItem
from app.schemas.prediction import FuelDepletionForecastResponse
from app.core.station_profiles import get_station_profile

logger = logging.getLogger(__name__)

# Window of recent telemetry used to learn the actual fuel burn rate.
BURN_LEARNING_WINDOW_HOURS = 168  # 7 days
FALLBACK_DAILY_BURN_LITERS = 1150.0


class PredictionService:

    @staticmethod
    def _estimate_daily_fuel_burn(
        db: Session,
        station_id: int,
        total_capacity_liters: float,
        fuel_item: Optional[LogisticsItem],
    ) -> Tuple[float, str]:
        """
        Learn the current daily fuel burn rate from observed telemetry rather
        than a hardcoded constant. Falls back gracefully through:

            1. Direct measurement: fuel-level drop over the last 7 days (reflects
               cold snaps / high-demand periods automatically). Skipped when the
               tank is clamped at a floor/ceiling and shows no observable drop.
            2. Diesel-inferred: average diesel generation over the last 7 days
               times the brake specific fuel consumption (~0.255 L/kWh). Works
               even when the fuel level is clamped, since generation is still
               active and physically drives consumption.
            3. The logistics item's nominal ``daily_consumption``.
            4. A conservative hardcoded fallback.

        Returns (liters_per_day, source_label).
        """
        # Brake Specific Fuel Consumption for Antarctic diesel generators
        # (~0.255 L/kWh), matching the value used by EnergySimulator.
        BSFC_L_PER_KWH = 0.255

        window = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .limit(BURN_LEARNING_WINDOW_HOURS)
            .all()
        )

        if len(window) >= 2:
            window_chrono = list(reversed(window))  # oldest -> newest
            oldest = window_chrono[0]
            newest = window_chrono[-1]
            t_old = oldest.timestamp
            t_new = newest.timestamp
            if t_old.tzinfo is None:
                t_old = t_old.replace(tzinfo=timezone.utc)
            if t_new.tzinfo is None:
                t_new = t_new.replace(tzinfo=timezone.utc)
            span_days = (t_new - t_old).total_seconds() / 86400.0

            # Tier 1: direct fuel-level measurement (only when tank is actively
            # draining — not clamped at a floor/ceiling).
            pct_drop = float(oldest.fuel_percentage) - float(newest.fuel_percentage)
            if span_days > 0.5 and pct_drop > 0.01:
                liters_burned = (pct_drop / 100.0) * total_capacity_liters
                learned = liters_burned / span_days
                if learned > 0:
                    return round(learned, 1), "telemetry_learned"

            # Tier 2: infer from actual diesel generation (active even when the
            # fuel level is clamped). daily_burn = avg_diesel_kw * 24h * BSFC.
            diesel_values = [
                float(r.diesel_generation_kw or 0.0) for r in window_chrono
            ]
            avg_diesel_kw = sum(diesel_values) / len(diesel_values) if diesel_values else 0.0
            if avg_diesel_kw > 1.0:
                inferred = avg_diesel_kw * 24.0 * BSFC_L_PER_KWH
                if inferred > 0:
                    return round(inferred, 1), "telemetry_diesel_inferred"

        if fuel_item and fuel_item.daily_consumption and fuel_item.daily_consumption > 0:
            return float(fuel_item.daily_consumption), "logistics_nominal"

        return FALLBACK_DAILY_BURN_LITERS, "fallback_constant"

    @staticmethod
    def forecast_fuel_depletion(
        db: Session,
        station_id: int,
        station_code: str,
    ) -> FuelDepletionForecastResponse:
        """
        Fuel depletion & critical threshold forecast service.
        Predicts days remaining until critical (10%) and complete depletion.

        The daily burn rate is learned from recent telemetry so the projection
        reacts to current operating conditions (e.g. cold-snap-driven heating
        surges) instead of a flat hardcoded constant.
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
        # Typical Antarctic station fuel storage from station engineering profile
        profile = get_station_profile(station_code)
        total_capacity_liters = profile.fuel_tank_capacity_liters
        current_liters = fuel_item.quantity if fuel_item else (total_capacity_liters * current_percentage / 100.0)
        daily_burn_liters, burn_source = PredictionService._estimate_daily_fuel_burn(
            db, station_id, total_capacity_liters, fuel_item
        )

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
            burn_rate_source=burn_source,
        )


prediction_service = PredictionService()

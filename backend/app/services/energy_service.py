from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.energy import EnergyTelemetry
from app.utils.calculations import calculate_energy_balance
from app.utils.validators import clamp_percentage, validate_non_negative


class EnergyService:
    @staticmethod
    def get_current_energy(db: Session, station_id: int) -> Optional[EnergyTelemetry]:
        return (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )

    @staticmethod
    def get_energy_history(db: Session, station_id: int, limit: int = 168) -> List[EnergyTelemetry]:
        """Returns chronological historical energy telemetry (default 7 days = 168 hourly records)."""
        records = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station_id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .limit(limit)
            .all()
        )
        return list(reversed(records))

    @staticmethod
    def record_energy_telemetry(
        db: Session,
        station_id: int,
        generation_kw: float,
        consumption_kw: float,
        battery_percentage: float,
        fuel_percentage: float,
        diesel_generation_kw: float = 0.0,
        solar_generation_kw: float = 0.0,
        battery_power_kw: float = 0.0,
        grid_status: str = "ONLINE",
        source: str = "simulation",
        is_simulated: bool = True,
        timestamp: Optional[datetime] = None,
    ) -> EnergyTelemetry:
        gen = max(0.0, float(generation_kw))
        con = max(0.0, float(consumption_kw))
        bal = calculate_energy_balance(gen, con)
        bat = clamp_percentage(battery_percentage)
        fuel = clamp_percentage(fuel_percentage)

        entry = EnergyTelemetry(
            station_id=station_id,
            timestamp=timestamp or datetime.now(timezone.utc),
            generation_kw=round(gen, 2),
            consumption_kw=round(con, 2),
            energy_balance=bal,
            battery_percentage=bat,
            battery_power_kw=round(float(battery_power_kw), 2),
            diesel_generation_kw=round(max(0.0, float(diesel_generation_kw)), 2),
            solar_generation_kw=round(max(0.0, float(solar_generation_kw)), 2),
            fuel_percentage=fuel,
            grid_status=grid_status,
            source=source,
            is_simulated=is_simulated,
        )
        db.add(entry)
        db.flush()
        return entry


energy_service = EnergyService()

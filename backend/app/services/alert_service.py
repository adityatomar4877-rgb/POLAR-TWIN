import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.energy import EnergyTelemetry
from app.models.sensor import SensorTelemetry
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.core.config import settings

logger = logging.getLogger(__name__)


class AlertService:
    @staticmethod
    def _is_duplicate_active_alert(
        db: Session, station_id: int, alert_type: str, title: str, window_minutes: int = settings.ALERT_DEDUP_WINDOW_MINUTES
    ) -> bool:
        """Checks if a matching unacknowledged alert already exists within recent window to prevent spam."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        existing = (
            db.query(Alert)
            .filter(
                Alert.station_id == station_id,
                Alert.alert_type == alert_type,
                Alert.title == title,
                Alert.acknowledged == False,
                Alert.created_at >= cutoff,
            )
            .first()
        )
        return existing is not None

    @staticmethod
    def create_alert(
        db: Session,
        station_id: int,
        alert_type: str,
        severity: str,
        title: str,
        message: str,
        source: str = "AlertEngine",
        related_entity_id: Optional[int] = None,
    ) -> Optional[Alert]:
        """Creates an alert if not a recent unacknowledged duplicate."""
        if AlertService._is_duplicate_active_alert(db, station_id, alert_type, title):
            return None

        alert = Alert(
            station_id=station_id,
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            source=source,
            related_entity_id=related_entity_id,
            acknowledged=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(alert)
        db.flush()
        logger.info(f"[{severity}] Alert triggered for Station #{station_id}: {title}")
        return alert

    @staticmethod
    def evaluate_station_conditions(
        db: Session,
        station_id: int,
        energy: Optional[EnergyTelemetry] = None,
        weather: Optional[SensorTelemetry] = None,
        equipment_list: Optional[List[Equipment]] = None,
        logistics_list: Optional[List[LogisticsItem]] = None,
    ) -> List[Alert]:
        """Automated multi-system threshold evaluation across energy, equipment, environment, and logistics."""
        new_alerts: List[Alert] = []

        # 1. Energy & Fuel Telemetry Checks
        if energy:
            # Battery State of Charge
            if energy.battery_percentage < settings.BATTERY_CRITICAL_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENERGY", "CRITICAL",
                    "Critical Battery Depletion",
                    f"Battery bank at {energy.battery_percentage:.1f}% (below critical {settings.BATTERY_CRITICAL_THRESHOLD}%). Immediate diesel spin-up required.",
                    related_entity_id=energy.id,
                )
                if a: new_alerts.append(a)
            elif energy.battery_percentage < settings.BATTERY_WARNING_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENERGY", "WARNING",
                    "Low Battery Reserve",
                    f"Battery bank at {energy.battery_percentage:.1f}% (below warning threshold {settings.BATTERY_WARNING_THRESHOLD}%).",
                    related_entity_id=energy.id,
                )
                if a: new_alerts.append(a)

            # Fuel Reserve Percentage
            if energy.fuel_percentage < settings.FUEL_CRITICAL_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENERGY", "CRITICAL",
                    "Critical Fuel Reserve Level",
                    f"Main fuel reserve is at {energy.fuel_percentage:.1f}%! Critical heating & power failure risk.",
                    related_entity_id=energy.id,
                )
                if a: new_alerts.append(a)
            elif energy.fuel_percentage < settings.FUEL_WARNING_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENERGY", "WARNING",
                    "Low Fuel Reserve",
                    f"Main fuel reserve is down to {energy.fuel_percentage:.1f}%. Resupply scheduling recommended.",
                    related_entity_id=energy.id,
                )
                if a: new_alerts.append(a)

            # Sustained Energy Deficit
            if energy.energy_balance < settings.ENERGY_DEFICIT_ALERT_KW and energy.battery_percentage < settings.ENERGY_DEFICIT_BATTERY_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENERGY", "WARNING",
                    "Severe Energy Deficit",
                    f"Station net power balance is negative ({energy.energy_balance:.1f} kW) with battery reserve at {energy.battery_percentage:.1f}%.",
                    related_entity_id=energy.id,
                )
                if a: new_alerts.append(a)

        # 2. Environmental Checks
        if weather:
            if weather.wind_speed >= settings.WIND_CRITICAL_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENVIRONMENT", "CRITICAL",
                    "Severe Blizzard / Katabatic Storm",
                    f"Violent katabatic winds recorded at {weather.wind_speed:.1f} km/h. Outdoor movements suspended.",
                )
                if a: new_alerts.append(a)
            elif weather.wind_speed >= settings.WIND_WARNING_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENVIRONMENT", "WARNING",
                    "High Wind Speed Advisory",
                    f"Strong wind velocity recorded at {weather.wind_speed:.1f} km/h.",
                )
                if a: new_alerts.append(a)

            if weather.temperature <= settings.TEMP_EXTREME_THRESHOLD:
                a = AlertService.create_alert(
                    db, station_id, "ENVIRONMENT", "WARNING",
                    "Extreme Deep Freeze Alert",
                    f"Ambient outdoor temperature dropped to {weather.temperature:.1f}°C. HVAC load surging.",
                )
                if a: new_alerts.append(a)

        # 3. Equipment Health Checks
        if equipment_list:
            for eq in equipment_list:
                if eq.status == "OFFLINE":
                    a = AlertService.create_alert(
                        db, station_id, "EQUIPMENT", "CRITICAL",
                        f"Equipment Offline: {eq.name}",
                        f"{eq.name} ({eq.equipment_type}) is OFFLINE. Redundancy degraded.",
                        related_entity_id=eq.id,
                    )
                    if a: new_alerts.append(a)
                elif eq.health_score < settings.EQUIPMENT_HEALTH_CRITICAL:
                    a = AlertService.create_alert(
                        db, station_id, "EQUIPMENT", "CRITICAL",
                        f"Critical Equipment Health: {eq.name}",
                        f"{eq.name} health score degraded to {eq.health_score:.1f}/100. (Operating Temp: {eq.temperature:.1f}°C, Efficiency: {eq.efficiency:.1f}%).",
                        related_entity_id=eq.id,
                    )
                    if a: new_alerts.append(a)
                elif eq.health_score < settings.EQUIPMENT_HEALTH_WARNING:
                    a = AlertService.create_alert(
                        db, station_id, "EQUIPMENT", "WARNING",
                        f"Equipment Degradation Warning: {eq.name}",
                        f"{eq.name} health score at {eq.health_score:.1f}/100. Maintenance inspection advised.",
                        related_entity_id=eq.id,
                    )
                    if a: new_alerts.append(a)

        # 4. Logistics Stock Checks
        if logistics_list:
            for item in logistics_list:
                if item.days_remaining < settings.LOGISTICS_CRITICAL_DAYS:
                    a = AlertService.create_alert(
                        db, station_id, "LOGISTICS", "CRITICAL",
                        f"Critical Stock Depletion: {item.item_name}",
                        f"{item.item_name} has only {item.days_remaining:.1f} days remaining ({item.quantity:.0f} {item.unit}). Immediate resupply mandatory.",
                        related_entity_id=item.id,
                    )
                    if a: new_alerts.append(a)
                elif item.days_remaining < settings.LOGISTICS_WARNING_DAYS:
                    a = AlertService.create_alert(
                        db, station_id, "LOGISTICS", "WARNING",
                        f"Low Supply Threshold: {item.item_name}",
                        f"{item.item_name} has {item.days_remaining:.1f} days remaining ({item.quantity:.0f} {item.unit}).",
                        related_entity_id=item.id,
                    )
                    if a: new_alerts.append(a)

        return new_alerts

    @staticmethod
    def acknowledge_alert(db: Session, alert_id: int) -> Optional[Alert]:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            alert.acknowledged = True
            db.commit()
            db.refresh(alert)
        return alert

    @staticmethod
    def get_alerts_by_station(db: Session, station_id: int, limit: int = 50) -> List[Alert]:
        return (
            db.query(Alert)
            .filter(Alert.station_id == station_id)
            .order_by(Alert.created_at.desc())
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_active_alerts(db: Session, station_id: Optional[int] = None) -> List[Alert]:
        query = db.query(Alert).filter(Alert.acknowledged == False)
        if station_id:
            query = query.filter(Alert.station_id == station_id)
        return query.order_by(Alert.created_at.desc()).all()


alert_service = AlertService()

import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.station import Station
from app.models.sensor import SensorTelemetry
from app.models.energy import EnergyTelemetry
from app.models.equipment import Equipment
from app.models.logistics import LogisticsItem
from app.services.weather_service import weather_service
from app.services.alert_service import alert_service
from app.simulation.energy_simulator import EnergySimulator
from app.simulation.equipment_simulator import EquipmentSimulator
from app.simulation.logistics_simulator import LogisticsSimulator

logger = logging.getLogger(__name__)


class TelemetryEngine:
    """Master Digital Twin simulation engine coordinating environment, microgrid, equipment, logistics, and alerts."""

    @staticmethod
    async def execute_simulation_cycle(
        db: Session,
        station: Station,
        active_scenario: str = "NORMAL_OPERATION",
        target_equipment_id: Optional[int] = None,
        dt_seconds: float = 10.0,
        broadcast_callback: Optional[Callable] = None,
    ) -> Dict:
        now = datetime.now(timezone.utc)

        # 1. Update Environment Telemetry
        weather_data = await weather_service.get_current_weather(
            station_code=station.code,
            lat=station.latitude,
            lon=station.longitude,
            elevation=station.elevation,
        )

        # Scenario overrides on weather
        if active_scenario == "EXTREME_COLD":
            weather_data["temperature"] = round(min(weather_data["temperature"], -44.5), 1)
            weather_data["wind_speed"] = round(max(weather_data["wind_speed"], 92.0), 1)
            weather_data["visibility"] = 1.2
            weather_data["is_simulated"] = True
            weather_data["source"] = "simulation_scenario_override"

        import random
        sensor_entry = SensorTelemetry(
            station_id=station.id,
            timestamp=now,
            temperature=round(weather_data["temperature"] + random.uniform(-0.15, 0.15), 1),
            wind_speed=round(max(0.0, weather_data["wind_speed"] + random.uniform(-0.8, 0.8)), 1),
            wind_direction=round((weather_data["wind_direction"] + random.uniform(-2.0, 2.0)) % 360, 1),
            pressure=round(weather_data["pressure"] + random.uniform(-0.2, 0.2), 1),
            humidity=round(max(10.0, min(100.0, weather_data["humidity"] + random.uniform(-1.0, 1.0))), 1),
            precipitation=weather_data["precipitation"],
            visibility=weather_data["visibility"],
            source=weather_data.get("source", "simulation"),
            is_simulated=weather_data.get("is_simulated", True),
        )
        db.add(sensor_entry)
        db.flush()

        # 2. Retrieve Previous Energy State & Equipment Statuses
        latest_energy = (
            db.query(EnergyTelemetry)
            .filter(EnergyTelemetry.station_id == station.id)
            .order_by(EnergyTelemetry.timestamp.desc())
            .first()
        )
        prev_bat = latest_energy.battery_percentage if latest_energy else 85.0
        prev_fuel = latest_energy.fuel_percentage if latest_energy else 75.0

        equipment_list = db.query(Equipment).filter(Equipment.station_id == station.id).all()
        gen1 = next((e for e in equipment_list if e.name == "Generator 1"), None)
        gen2 = next((e for e in equipment_list if e.name == "Generator 2"), None)
        gen1_online = (gen1.status in ["NORMAL", "ONLINE", "RUNNING"]) if gen1 else True
        gen2_online = (gen2.status in ["ONLINE", "RUNNING"]) if gen2 else False

        # 3. Simulate Microgrid Energy
        sim_energy = EnergySimulator.simulate_energy_cycle(
            station_code=station.code,
            ambient_temperature=sensor_entry.temperature,
            wind_speed=sensor_entry.wind_speed,
            prev_battery_pct=prev_bat,
            prev_fuel_pct=prev_fuel,
            active_scenario=active_scenario,
            generator_1_online=gen1_online,
            generator_2_online=gen2_online,
            dt_seconds=dt_seconds,
        )

        energy_entry = EnergyTelemetry(
            station_id=station.id,
            timestamp=now,
            generation_kw=sim_energy["generation_kw"],
            consumption_kw=sim_energy["consumption_kw"],
            energy_balance=sim_energy["energy_balance"],
            battery_percentage=sim_energy["battery_percentage"],
            battery_power_kw=sim_energy["battery_power_kw"],
            diesel_generation_kw=sim_energy["diesel_generation_kw"],
            solar_generation_kw=sim_energy["solar_generation_kw"],
            fuel_percentage=sim_energy["fuel_percentage"],
            grid_status=sim_energy["grid_status"],
            source="simulation",
            is_simulated=True,
        )
        db.add(energy_entry)
        db.flush()

        # 4. Simulate Equipment Wear & Thermal Dynamics
        equipment_list = db.query(Equipment).filter(Equipment.station_id == station.id).all()
        for eq in equipment_list:
            EquipmentSimulator.update_equipment_state(
                equipment=eq,
                active_scenario=active_scenario,
                target_equipment_id=target_equipment_id,
                dt_seconds=dt_seconds,
            )
        db.flush()

        # 5. Simulate Logistics & Consumable Attrition
        logistics_list = db.query(LogisticsItem).filter(LogisticsItem.station_id == station.id).all()
        for item in logistics_list:
            # Sync fuel logistics quantity with fuel percentage
            if item.category == "FUEL":
                total_capacity = 75000.0 if "MAITRI" in station.code.upper() else 60000.0
                item.quantity = round(total_capacity * (sim_energy["fuel_percentage"] / 100.0), 1)
            LogisticsSimulator.update_logistics_item(item, active_scenario=active_scenario, dt_seconds=dt_seconds)
        db.flush()

        # 6. Automatic Anomaly Detection & Alerts
        new_alerts = alert_service.evaluate_station_conditions(
            db=db,
            station_id=station.id,
            energy=energy_entry,
            weather=sensor_entry,
            equipment_list=equipment_list,
            logistics_list=logistics_list,
        )

        db.commit()

        cycle_summary = {
            "station_id": station.id,
            "station_code": station.code,
            "timestamp": now.isoformat(),
            "environment": {
                "temperature": sensor_entry.temperature,
                "wind_speed": sensor_entry.wind_speed,
                "source": sensor_entry.source,
                "is_simulated": sensor_entry.is_simulated,
            },
            "energy": {
                "generation_kw": energy_entry.generation_kw,
                "consumption_kw": energy_entry.consumption_kw,
                "energy_balance": energy_entry.energy_balance,
                "battery_percentage": energy_entry.battery_percentage,
                "fuel_percentage": energy_entry.fuel_percentage,
                "grid_status": energy_entry.grid_status,
            },
            "equipment_count": len(equipment_list),
            "new_alerts_triggered": len(new_alerts),
        }

        # 7. WebSocket Broadcast if callback provided
        if broadcast_callback:
            try:
                if asyncio.iscoroutinefunction(broadcast_callback):
                    await broadcast_callback(station.code.lower(), cycle_summary)
                else:
                    broadcast_callback(station.code.lower(), cycle_summary)
            except Exception as e:
                logger.debug(f"Broadcast callback notification skipped: {e}")

        return cycle_summary


telemetry_engine = TelemetryEngine()
